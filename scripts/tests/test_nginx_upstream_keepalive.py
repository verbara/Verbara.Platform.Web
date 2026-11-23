"""The web image's nginx reuses its connections to the services behind it.

Without reuse every proxied request opens a new TCP connection, each closed one holds
one of the container's ephemeral ports in TIME_WAIT for about 60 s, and under
sustained load nginx runs out of ports and answers 502. nginx reuses a connection
only when all of these hold:

- the proxy_pass target is an `upstream` block (a variable or a host:port target
  is resolved per request and keeps no pool);
- the upstream block keeps a pool (`keepalive N;`, N >= 1);
- the location speaks HTTP/1.1 (`proxy_http_version 1.1;`, nginx's default is 1.0);
- the location replaces the Connection header with "" or with a variable that a
  `map $http_upgrade` empties when the client asks for no upgrade (a literal
  "upgrade" closes every plain request's connection too).

Reads nginx.conf with the file docker/18-verbara-realtime-upstream.envsh writes at
start-up spliced in where nginx.conf includes it (the envsh runs under `sh`, on a
copy whose three fixed paths point into a temp dir). The container side of the same
property is the KA block of scripts/web-image/check-nginx.sh. Stdlib unittest only.

The same rendering also guards that the image starts without a realtime service
whatever resolv.conf holds (StartupLookupTests; the NS block of check-nginx.sh is
its container side), and that the image build refuses an nginx older than the
1.27.3 that `server ... resolve` needs (NginxVersionFloorTests).
"""
import os
import shutil
import subprocess
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.normpath(os.path.join(_HERE, os.pardir, os.pardir))
_CONF = os.path.join(_ROOT, "nginx.conf")
_ENVSH = os.path.join(_ROOT, "docker", "18-verbara-realtime-upstream.envsh")
_INCLUDE = "/var/run/verbara-realtime-upstream.conf"
_RESOLV = "/etc/resolv.conf"
_HOSTS = "/etc/hosts"
_DOCKERFILE = os.path.join(_ROOT, "Dockerfile")
_REQUIRE = os.path.join(_ROOT, "docker", "require-nginx-version.sh")
_NGINX_FLOOR = (1, 27, 3)
_DEFAULT_HOSTS = "127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost\n172.18.0.5\tweb-0\n"


class Directive:
    def __init__(self, name, args, children):
        self.name, self.args, self.children = name, args, children

    def __repr__(self):
        return f"{self.name} {self.args}"


def _tokens(text):
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
        elif c == "#":
            while i < n and text[i] != "\n":
                i += 1
        elif c in "{};":
            yield c
            i += 1
        elif c in "\"'":
            j = i + 1
            buf = []
            while text[j] != c:
                if text[j] == "\\":
                    j += 1
                buf.append(text[j])
                j += 1
            yield ("str", "".join(buf))
            i = j + 1
        else:
            j = i
            while j < n and not text[j].isspace() and text[j] not in "{};":
                j += 1
            yield ("str", text[i:j])
            i = j


def parse(text):
    """nginx configuration text -> a list of Directive (children is None for a simple one)."""
    stack = [[]]
    current = []
    for tok in _tokens(text):
        if tok == ";":
            stack[-1].append(Directive(current[0], current[1:], None))
            current = []
        elif tok == "{":
            block = Directive(current[0] if current else "", current[1:], [])
            stack[-1].append(block)
            stack.append(block.children)
            current = []
        elif tok == "}":
            if current:  # a map entry is a directive whose name is its key
                stack[-1].append(Directive(current[0], current[1:], None))
                current = []
            stack.pop()
        else:
            current.append(tok[1])
    if len(stack) != 1 or current:
        raise ValueError("unbalanced nginx configuration")
    return stack[0]


def walk(directives):
    for d in directives:
        yield d
        if d.children is not None:
            yield from walk(d.children)


def proxied_locations(directives):
    return [d for d in walk(directives)
            if d.name == "location" and d.children is not None
            and any(c.name == "proxy_pass" for c in d.children)]


def _upgrade_variables(directives):
    out = set()
    for m in walk(directives):
        if m.name != "map" or m.children is None or len(m.args) != 2 or m.args[0] != "$http_upgrade":
            continue
        entries = {e.name: e.args for e in m.children}
        if entries.get("") == [""] and entries.get("default") == ["upgrade"] \
                and all(len(a) == 1 and a[0] in ("", "upgrade") for a in entries.values()):
            out.add(m.args[1])
    return out


def scan(text):
    """Every way the configuration opens a new upstream connection per request; empty when none."""
    directives = parse(text)
    violations = []
    upstreams = {d.args[0]: d for d in walk(directives)
                 if d.name == "upstream" and d.children is not None and len(d.args) == 1}
    for name, up in upstreams.items():
        ka = [c for c in up.children if c.name == "keepalive"]
        if len(ka) != 1 or len(ka[0].args) != 1 or not ka[0].args[0].isdigit() or int(ka[0].args[0]) < 1:
            violations.append(f"upstream '{name}' declares no 'keepalive N;' with N >= 1")
    upgrade_vars = _upgrade_variables(directives)
    for loc in proxied_locations(directives):
        where = f"location '{' '.join(loc.args)}'"
        target = next(c for c in loc.children if c.name == "proxy_pass").args[0]
        host = target.split("://", 1)[-1].split("/", 1)[0]
        if host not in upstreams:
            violations.append(f"{where} proxies to '{target}', which names no upstream block, so it keeps no pool")
        versions = [c for c in loc.children if c.name == "proxy_http_version"]
        if not versions or versions[-1].args != ["1.1"]:
            violations.append(f"{where} does not set 'proxy_http_version 1.1;'")
        conn = [c for c in loc.children if c.name == "proxy_set_header"
                and len(c.args) == 2 and c.args[0].lower() == "connection"]
        if not conn:
            violations.append(f"{where} does not replace the Connection header")
        elif len(conn) != 1 or not (conn[0].args[1] == "" or conn[0].args[1] in upgrade_vars):
            violations.append(f"{where} sets Connection to '{conn[-1].args[1]}' on every request")
    return violations


def render_envsh(resolv_conf, env=None, hosts=_DEFAULT_HOSTS):
    """Runs the envsh on a copy whose fixed paths point into a temp dir; returns (rc, written, stderr)."""
    tmp = tempfile.mkdtemp()
    try:
        resolv = os.path.join(tmp, "resolv.conf")
        hosts_path = os.path.join(tmp, "hosts")
        out = os.path.join(tmp, "upstream.conf")
        with open(resolv, "w") as f:
            f.write(resolv_conf)
        with open(hosts_path, "w") as f:
            f.write(hosts)
        with open(_ENVSH) as f:
            script = f.read()
        assert _INCLUDE in script and _RESOLV in script and _HOSTS in script, "the envsh's fixed paths moved"
        copy = os.path.join(tmp, "envsh.sh")
        with open(copy, "w") as f:
            f.write(script.replace(_INCLUDE, out).replace(_RESOLV, resolv).replace(_HOSTS, hosts_path))
        e = {"PATH": os.environ.get("PATH", "/usr/bin:/bin")}
        e.update(env or {})
        # The entrypoint sources it (`return` on bad input), so source it here too.
        p = subprocess.run(["sh", "-c", '. "$0"', copy], env=e, capture_output=True, text=True)
        written = None
        if os.path.exists(out):
            with open(out) as f:
                written = f.read()
        return p.returncode, written, p.stderr
    finally:
        shutil.rmtree(tmp)


def shipped_config(resolv_conf="nameserver 10.96.0.10\n", env=None, hosts=_DEFAULT_HOSTS):
    rc, written, err = render_envsh(resolv_conf, env, hosts)
    assert rc == 0, err
    with open(_CONF) as f:
        conf = f.read()
    line = f"include {_INCLUDE};"
    assert conf.count(line) == 1, "nginx.conf must include the envsh's upstream exactly once"
    return conf.replace(line, written)


_GOOD = (
    'map $http_upgrade $connection_upgrade { default upgrade; "" ""; }\n'
    "upstream api { server platform-api:5000; keepalive 64; }\n"
    "server {\n"
    '  location /api/ { proxy_pass http://api; proxy_http_version 1.1; proxy_set_header Connection ""; }\n'
    "  location /ws/ { proxy_pass http://api; proxy_http_version 1.1;\n"
    "    proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; }\n"
    "}\n"
)


class ShippedConfigTests(unittest.TestCase):
    def test_shipped_config_reuses_every_upstream_connection(self):
        for label, resolv, env in [
            ("compose", "nameserver 127.0.0.11\n", {}),
            ("kubernetes", "search ns.svc.cluster.local svc.cluster.local\nnameserver 10.96.0.10\n",
             {"KUBERNETES_SERVICE_HOST": "10.96.0.1"}),
            ("ipv6 resolver", "nameserver fd00::a\n", {}),
            ("no nameserver", "", {}),
            ("no nameserver, name in /etc/hosts", "", {"VERBARA_REALTIME_UPSTREAM": "rt-hosts:5030"}),
            ("ip literal", "", {"VERBARA_REALTIME_UPSTREAM": "10.1.2.3:5030"}),
        ]:
            with self.subTest(label):
                self.assertEqual(scan(shipped_config(resolv, env)), [])

    def test_scan_reaches_every_proxied_location(self):
        # Liveness: a parser that finds fewer locations would pass vacuously.
        locs = proxied_locations(parse(shipped_config()))
        self.assertEqual(sorted(l.args[0] for l in locs), ["/api/", "/health", "/hubs/", "/ws/"])
        ups = sorted(d.args[0] for d in walk(parse(shipped_config())) if d.name == "upstream")
        self.assertEqual(ups, ["platform-api", "verbara_realtime"])

    def test_websocket_locations_send_upgrade_only_on_an_upgrade(self):
        directives = parse(shipped_config())
        for path in ("/hubs/", "/ws/"):
            loc = next(l for l in proxied_locations(directives) if l.args == [path])
            headers = {c.args[0]: c.args[1] for c in loc.children if c.name == "proxy_set_header"}
            self.assertEqual(headers.get("Upgrade"), "$http_upgrade", path)
            self.assertEqual(headers.get("Connection"), "$connection_upgrade", path)
        self.assertIn("$connection_upgrade", _upgrade_variables(directives))

    def test_envsh_renders_a_resolving_upstream_so_the_image_starts_without_realtime(self):
        rc, written, err = render_envsh("search ns.svc.cluster.local\nnameserver 10.96.0.10\n",
                                        {"KUBERNETES_SERVICE_HOST": "10.96.0.1"})
        self.assertEqual(rc, 0, err)
        up = next(d for d in walk(parse(written)) if d.name == "upstream")
        body = {c.name: c.args for c in up.children}
        self.assertEqual(body["server"], ["platform-realtime.ns.svc.cluster.local:5030", "resolve"])
        self.assertEqual(body["resolver"], ["10.96.0.10", "valid=10s"])
        self.assertEqual(body["zone"][0], "verbara_realtime")
        self.assertEqual(body["keepalive"], ["64"])

    def test_envsh_still_refuses_an_upstream_that_is_not_host_port(self):
        rc, written, err = render_envsh("nameserver 127.0.0.11\n",
                                        {"VERBARA_REALTIME_UPSTREAM": "realtime:5030;evil"})
        self.assertNotEqual(rc, 0)
        self.assertIsNone(written)
        self.assertIn("must be host:port", err)


class ScanTests(unittest.TestCase):
    def test_accepts_a_pooled_config(self):
        self.assertEqual(scan(_GOOD), [])

    def test_flags_an_upstream_without_keepalive(self):
        for ka in ("", "keepalive 0;", "keepalive many;"):
            with self.subTest(ka):
                v = scan(_GOOD.replace("keepalive 64;", ka))
                self.assertEqual(len(v), 1, v)
                self.assertIn("upstream 'api' declares no 'keepalive N;'", v[0])

    def test_flags_http_1_0(self):
        v = scan(_GOOD.replace('proxy_http_version 1.1; proxy_set_header Connection ""', 'proxy_set_header Connection ""'))
        self.assertEqual(v, ["location '/api/' does not set 'proxy_http_version 1.1;'"])

    def test_flags_a_location_that_leaves_connection_to_nginx(self):
        v = scan(_GOOD.replace('proxy_set_header Connection "";', ""))
        self.assertEqual(v, ["location '/api/' does not replace the Connection header"])

    def test_flags_a_literal_upgrade(self):
        for value in ('"upgrade"', "upgrade", "close", "$http_connection"):
            with self.subTest(value):
                v = scan(_GOOD.replace("Connection $connection_upgrade", f"Connection {value}"))
                self.assertEqual(len(v), 1, v)
                self.assertIn("location '/ws/' sets Connection to", v[0])

    def test_flags_a_map_that_does_not_empty_connection(self):
        for m in ('map $http_upgrade $connection_upgrade { default upgrade; }',
                  'map $http_upgrade $connection_upgrade { default upgrade; "" close; }',
                  'map $http_host $connection_upgrade { default upgrade; "" ""; }'):
            with self.subTest(m):
                v = scan(_GOOD.replace('map $http_upgrade $connection_upgrade { default upgrade; "" ""; }', m))
                self.assertEqual(len(v), 1, v)

    def test_flags_a_proxy_pass_that_names_no_upstream(self):
        for target in ("http://$verbara_realtime", "http://platform-api:5000"):
            with self.subTest(target):
                v = scan(_GOOD.replace("location /api/ { proxy_pass http://api;",
                                       f"location /api/ {{ proxy_pass {target};"))
                self.assertEqual(len(v), 1, v)
                self.assertIn("names no upstream block", v[0])

    def test_flags_the_shipped_config_with_its_keepalive_removed(self):
        # Mutation check against the real files, not only the fixture.
        conf = shipped_config().replace("keepalive 64;", "")
        self.assertEqual(len([x for x in scan(conf) if "keepalive" in x]), 2)


def _is_ipv4(host):
    parts = host.split(".")
    return len(parts) == 4 and all(p.isdigit() for p in parts)


def _hosts_names(hosts):
    names = set()
    for line in hosts.splitlines():
        fields = line.split("#", 1)[0].split()
        names.update(n.lower() for n in fields[1:])
    return names


def startup_lookups(written, hosts):
    """Names nginx must look up through DNS at start-up, where a missing name stops it.

    A server with `resolve` is looked up by nginx's resolver after start-up, a `down`
    server is never contacted, and an IPv4 address or a name /etc/hosts lists needs no
    DNS. Any other server name fails the start when it does not resolve.
    """
    listed = _hosts_names(hosts)
    out = []
    for up in (d for d in walk(parse(written)) if d.name == "upstream"):
        resolver = any(c.name == "resolver" for c in up.children)
        for srv in (c for c in up.children if c.name == "server"):
            host = srv.args[0].rsplit(":", 1)[0]
            if "down" in srv.args[1:] or _is_ipv4(host) or host.lower() in listed:
                continue
            if "resolve" in srv.args[1:] and resolver:
                continue
            out.append(host)
    return out


def _server(written):
    up = next(d for d in walk(parse(written)) if d.name == "upstream")
    return next(c.args for c in up.children if c.name == "server")


class StartupLookupTests(unittest.TestCase):
    """The image starts with no realtime service, whatever resolv.conf holds."""

    def test_no_rendering_needs_a_start_up_lookup_that_can_fail(self):
        hosts_rt = _DEFAULT_HOSTS + "172.18.0.9\trt-hosts rt-hosts.local\n"
        for label, resolv, env, hosts in [
            ("compose", "nameserver 127.0.0.11\n", {}, _DEFAULT_HOSTS),
            ("kubernetes", "search ns.svc.cluster.local\nnameserver 10.96.0.10\n",
             {"KUBERNETES_SERVICE_HOST": "10.96.0.1"}, _DEFAULT_HOSTS),
            ("no nameserver", "", {}, _DEFAULT_HOSTS),
            ("no nameserver, only options", "options ndots:0\nsearch example.test\n", {}, _DEFAULT_HOSTS),
            ("no nameserver, kubernetes", "search ns.svc.cluster.local\n",
             {"KUBERNETES_SERVICE_HOST": "10.96.0.1"}, _DEFAULT_HOSTS),
            ("no nameserver, name in /etc/hosts", "", {"VERBARA_REALTIME_UPSTREAM": "rt-hosts:5030"}, hosts_rt),
            ("no nameserver, ip literal", "", {"VERBARA_REALTIME_UPSTREAM": "10.1.2.3:5030"}, _DEFAULT_HOSTS),
        ]:
            with self.subTest(label):
                rc, written, err = render_envsh(resolv, env, hosts)
                self.assertEqual(rc, 0, err)
                self.assertEqual(startup_lookups(written, hosts), [], written)

    def test_no_nameserver_writes_a_down_server_and_keeps_the_pool(self):
        rc, written, err = render_envsh("", {})
        self.assertEqual(rc, 0, err)
        self.assertEqual(_server(written), ["127.0.0.1:5030", "down"])
        self.assertIn("resolv.conf has no nameserver", err)
        self.assertEqual(scan(shipped_config("", {})), [])

    def test_a_name_in_etc_hosts_is_a_plain_server_even_with_a_nameserver(self):
        # nginx's resolver never reads /etc/hosts: `resolve` would leave the name unresolved.
        hosts = _DEFAULT_HOSTS + "172.18.0.9 other  RT-Hosts # an alias\n"
        for resolv in ("nameserver 127.0.0.11\n", ""):
            with self.subTest(resolv=resolv):
                rc, written, err = render_envsh(resolv, {"VERBARA_REALTIME_UPSTREAM": "rt-hosts:5030"}, hosts)
                self.assertEqual(rc, 0, err)
                self.assertEqual(_server(written), ["rt-hosts:5030"])

    def test_a_name_only_in_a_hosts_comment_is_not_listed(self):
        hosts = _DEFAULT_HOSTS + "# 172.18.0.9 rt-hosts\n"
        rc, written, err = render_envsh("", {"VERBARA_REALTIME_UPSTREAM": "rt-hosts:5030"}, hosts)
        self.assertEqual(rc, 0, err)
        self.assertEqual(_server(written), ["127.0.0.1:5030", "down"])

    def test_an_ip_literal_is_a_plain_server(self):
        rc, written, err = render_envsh("nameserver 127.0.0.11\n", {"VERBARA_REALTIME_UPSTREAM": "10.1.2.3:5030"})
        self.assertEqual(rc, 0, err)
        self.assertEqual(_server(written), ["10.1.2.3:5030"])

    def test_startup_lookups_flags_a_plain_name_with_no_nameserver(self):
        # Liveness: the property this suite guards is the one PR #570's envsh broke.
        written = "upstream verbara_realtime { zone z 64k; server realtime:5030; keepalive 64; }"
        self.assertEqual(startup_lookups(written, _DEFAULT_HOSTS), ["realtime"])
        written = "upstream verbara_realtime { zone z 64k; server realtime:5030 resolve; keepalive 64; }"
        self.assertEqual(startup_lookups(written, _DEFAULT_HOSTS), ["realtime"])


def _final_stage(dockerfile):
    lines = dockerfile.splitlines()
    start = max(i for i, l in enumerate(lines) if l.upper().startswith("FROM "))
    return lines[start], "\n".join(lines[start + 1:]).replace("\\\n", " ")


def run_require(version_output, minimum="1.27.3"):
    """Runs require-nginx-version.sh with a fake `nginx -v` that prints version_output."""
    tmp = tempfile.mkdtemp()
    try:
        fake = os.path.join(tmp, "nginx")
        with open(fake, "w") as f:
            f.write("#!/bin/sh\nprintf '%s\\n' \"$FAKE_NGINX_V\" >&2\n")
        os.chmod(fake, 0o755)
        env = {"PATH": tmp + os.pathsep + os.environ.get("PATH", "/usr/bin:/bin"), "FAKE_NGINX_V": version_output}
        p = subprocess.run(["sh", _REQUIRE, minimum], env=env, capture_output=True, text=True)
        return p.returncode, p.stdout + p.stderr
    finally:
        shutil.rmtree(tmp)


class NginxVersionFloorTests(unittest.TestCase):
    """The image build refuses an nginx too old for `server ... resolve`."""

    def test_the_final_stage_checks_the_floor_before_copying_the_config(self):
        with open(_DOCKERFILE) as f:
            base, body = _final_stage(f.read())
        self.assertTrue(base.split()[1].startswith("nginx:"), base)
        calls = [l.split("sh /tmp/require-nginx-version.sh", 1)[1].split() for l in body.splitlines()
                 if l.startswith("RUN ") and "sh /tmp/require-nginx-version.sh" in l]
        self.assertEqual(len(calls), 1, body)
        floor = tuple(int(x) for x in calls[0][0].split("."))
        self.assertGreaterEqual(floor, _NGINX_FLOOR)
        self.assertLess(body.index("require-nginx-version.sh"), body.index("COPY nginx.conf"))

    def test_the_envsh_still_needs_the_floor(self):
        # If `resolve` ever leaves the envsh, the floor may go with it; until then it stays.
        with open(_ENVSH) as f:
            self.assertIn("resolve;", f.read())

    def test_require_accepts_the_floor_and_later(self):
        for v in ("nginx version: nginx/1.27.3", "nginx version: nginx/1.27.10",
                  "nginx version: nginx/1.28.0", "nginx version: nginx/1.31.7", "nginx version: nginx/2.0.0"):
            with self.subTest(v):
                rc, out = run_require(v)
                self.assertEqual(rc, 0, out)

    def test_require_refuses_an_older_or_unreadable_nginx(self):
        for v in ("nginx version: nginx/1.27.2", "nginx version: nginx/1.26.3", "nginx version: nginx/1.9.15",
                  "nginx version: nginx/0.99.99", "nginx: command not found", ""):
            with self.subTest(v):
                rc, out = run_require(v)
                self.assertNotEqual(rc, 0, out)
                self.assertIn("require-nginx-version.sh:", out)

    def test_require_names_the_version_it_found_and_the_one_it_needs(self):
        rc, out = run_require("nginx version: nginx/1.27.2")
        self.assertIn("nginx 1.27.2", out)
        self.assertIn("1.27.3 or later", out)


if __name__ == "__main__":
    unittest.main()
