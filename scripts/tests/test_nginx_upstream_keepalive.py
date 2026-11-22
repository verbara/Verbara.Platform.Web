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
copy whose two fixed paths point into a temp dir). The container side of the same
property is the KA block of scripts/web-image/check-nginx.sh. Stdlib unittest only.
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


def render_envsh(resolv_conf, env=None):
    """Runs the envsh on a copy whose fixed paths point into a temp dir; returns (rc, written, stderr)."""
    tmp = tempfile.mkdtemp()
    try:
        resolv = os.path.join(tmp, "resolv.conf")
        out = os.path.join(tmp, "upstream.conf")
        with open(resolv, "w") as f:
            f.write(resolv_conf)
        with open(_ENVSH) as f:
            script = f.read()
        assert _INCLUDE in script and _RESOLV in script, "the envsh's fixed paths moved"
        copy = os.path.join(tmp, "envsh.sh")
        with open(copy, "w") as f:
            f.write(script.replace(_INCLUDE, out).replace(_RESOLV, resolv))
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


def shipped_config(resolv_conf="nameserver 10.96.0.10\n", env=None):
    rc, written, err = render_envsh(resolv_conf, env)
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


if __name__ == "__main__":
    unittest.main()
