#!/usr/bin/env python3
"""Fail CI when the console calls an API route the OpenAPI document does not declare.

Usage: check-api-routes.py [repo-root]

The class of bug behind #413 (a PUT the server mapped as POST) and #418 (a whole page
calling /api/v1/notification-rules, which Platform never mapped): the console's request
compiles, its tests pass against MSW mocks, and only a real server answers 404/405.
The generated OpenAPI types (src/core/api/generated/openapi.d.ts, regenerated from
Platform's exported document) already list every route Platform maps, so this guard
checks every console API call against them.

What is scanned (src/**/*.ts|tsx, excluding src/core/api/generated/ and *.test.*):
  * customFetch({ url, method }) and customFetchWithHeaders({ url, method }) — the
    client wrappers in src/core/api/client.ts that nearly every hook uses;
  * fetch(<literal>, { method }) whose literal URL starts with /api/ — the few raw
    calls (login, refresh, media upload, retention, agent departure). A raw fetch
    without a `method` is a GET.
A literal followed by `as const` counts as that literal.
Out of scope, counted and printed as "unresolved" but never failed: a wrapper call whose
url or method is not a string/template literal (a variable, a ternary, `'a' + b`), or
whose argument is not an object literal; raw fetch() calls whose first argument is not
a literal /api/ URL (e.g. `fetch(url.toString())`) are not counted at all. Set
API_ROUTES_VERBOSE=1 to list the unresolved calls.
Comments and string contents are never mistaken for calls.

URL normalisation (the rule the baseline keys use):
  1. every template expression ${...} becomes one placeholder, rendered `{*}`;
  2. the query string is dropped: everything from the first literal `?`;
  3. a template expression that ENDS the URL glued to literal text of the same
     segment (`/analytics/current-interval${params}`) is a query suffix built at
     runtime, so it is dropped too (a placeholder after `/` is a path segment);
  4. a trailing `/` is dropped (`/partner/revenue/` == `/partner/revenue`).
A call segment matches a document segment when they are equal or when the document
segment is a parameter (`{id}`; `v{version}` matches `v1`). When several document paths
match, the most specific decides, as in ASP.NET Core route precedence: a literal segment
beats a parameter, so PUT /routes/reorder is a method-mismatch against POST
/routes/reorder even though PUT /routes/{id} exists (the server would route it there). A placeholder never matches
a literal document segment: `/routes/${id}` does not match `/routes/reorder`.

Two violations:
  no-path          the normalised path matches no path in the document;
  method-mismatch  it matches, but none of the matching paths declares that method
                   (a method is declared by `get: {`, not by `get?: never`).
Each is tolerated only when its exact (method, path, file) is in
console-api-routes-baseline.json, which can only SHRINK: an entry that no longer
occurs (the call was fixed, removed or moved) fails as stale, so the floor ratchets
down. Never add an entry for a new call — fix the call or map the route in Platform.

Liveness: if fewer than the baseline's "min_scanned_calls" calls are found the scan is
mis-wired (wrong root, renamed wrapper) and would pass vacuously — exit 1.

Dependency-free (stdlib only). Exit 0 = pass, 1 = at least one violation.
"""
import json
import os
import re
import sys

SRC_DIR = "src"
GENERATED_DIR = "src/core/api/generated"
OPENAPI_FILE = "src/core/api/generated/openapi.d.ts"
BASELINE_FILE = "console-api-routes-baseline.json"
WRAPPERS = ("customFetch", "customFetchWithHeaders")
HTTP_METHODS = ("get", "put", "post", "delete", "options", "head", "patch", "trace")
PLACEHOLDER = "\x00"
PLACEHOLDER_TEXT = "{*}"

# --------------------------------------------------------------------------- lexer


def code_mask(src):
    """Per-character class: 1 = code, 0 = comment/string/template text, 2 = template
    delimiter (`${` or its closing `}`), 3 = the opening quote/backtick of a literal.
    Template expressions are code."""
    n = len(src)
    mask = bytearray(n)
    i = 0
    stack = []  # entries: "tpl" (inside template text) or [depth] (inside ${ })
    prev_code = ""  # last significant code char, for the regex-literal heuristic

    def in_template_text():
        return bool(stack) and stack[-1] == "tpl"

    while i < n:
        if in_template_text():
            c = src[i]
            if c == "\\":
                i += 2
                continue
            if c == "`":
                stack.pop()
                i += 1
                prev_code = "`"
                continue
            if src.startswith("${", i):
                mask[i] = mask[i + 1] = 2
                stack.append([0])
                i += 2
                prev_code = "{"
                continue
            i += 1
            continue
        c = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in "'\"":
            mask[i] = 3
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            i = j + 1
            prev_code = c
            continue
        if c == "`":
            mask[i] = 3
            stack.append("tpl")
            i += 1
            continue
        if c == "/" and prev_code in "(,=:[!&|?{};" and prev_code != "":
            # regex literal: skip to the closing unescaped slash (outside a class)
            j = i + 1
            in_class = False
            while j < n and src[j] != "\n":
                ch = src[j]
                if ch == "\\":
                    j += 2
                    continue
                if ch == "[":
                    in_class = True
                elif ch == "]":
                    in_class = False
                elif ch == "/" and not in_class:
                    break
                j += 1
            i = j + 1
            prev_code = "/"
            continue
        if stack and isinstance(stack[-1], list):
            if c == "{":
                stack[-1][0] += 1
            elif c == "}":
                if stack[-1][0] == 0:
                    mask[i] = 2
                    stack.pop()
                    i += 1
                    continue
                stack[-1][0] -= 1
        mask[i] = 1
        if not c.isspace():
            prev_code = c
        i += 1
    return mask


def _skip_ws(src, mask, i):
    """Skip whitespace and comments (mask 0); stop at code or a literal opener (mask 3)."""
    n = len(src)
    while i < n and (mask[i] == 0 or src[i].isspace()):
        i += 1
    return i


def _read_literal(src, mask, i):
    """Read a string/template literal starting at i. Returns (parts, end) where parts is
    a list of ("text", s) / ("expr", s), or (None, i) when i does not start a literal."""
    n = len(src)
    if i >= n or src[i] not in "'\"`":
        return None, i
    quote = src[i]
    if quote != "`":
        j = i + 1
        buf = []
        while j < n and src[j] != quote:
            if src[j] == "\\" and j + 1 < n:
                buf.append(src[j + 1])
                j += 2
                continue
            buf.append(src[j])
            j += 1
        return [("text", "".join(buf))], j + 1
    parts = []
    j = i + 1
    buf = []
    while j < n:
        if src[j] == "\\" and j + 1 < n:
            buf.append(src[j + 1])
            j += 2
            continue
        if src[j] == "`":
            break
        if mask[j] == 2:  # `${`
            if buf:
                parts.append(("text", "".join(buf)))
                buf = []
            k = j + 2
            depth = 0
            while k < n:
                if mask[k] == 2 and src.startswith("${", k):
                    depth += 1
                    k += 2
                    continue
                if mask[k] == 2:
                    if depth == 0:
                        break
                    depth -= 1
                k += 1
            parts.append(("expr", src[j + 2:k]))
            j = k + 1
            continue
        buf.append(src[j])
        j += 1
    if buf:
        parts.append(("text", "".join(buf)))
    return parts, j + 1


def _matching_close(src, mask, i):
    """i points at an opening ( { [ in code; return the index of its matching closer."""
    pairs = {"(": ")", "{": "}", "[": "]"}
    depth = 0
    n = len(src)
    while i < n:
        if mask[i] == 1:
            c = src[i]
            if c in pairs:
                depth += 1
            elif c in ")}]":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return n


def _object_props(src, mask, start, end, names):
    """Top-level properties of the object literal src[start] == '{' .. src[end] == '}'.
    Returns {name: value_start_index or "shorthand"} for the requested names."""
    found = {}
    depth = 0
    i = start
    expect_key = False
    while i < end:
        if mask[i] == 1:
            c = src[i]
            if c in "({[":
                depth += 1
                if depth == 1:
                    expect_key = True
                i += 1
                continue
            if c in ")}]":
                depth -= 1
                i += 1
                continue
            if depth == 1 and c == ",":
                expect_key = True
                i += 1
                continue
            if depth == 1 and expect_key and not c.isspace():
                expect_key = False
                m = re.compile(r"([A-Za-z_$][\w$]*)\s*([:,}])").match(src, i)
                if m and m.group(1) in names:
                    if m.group(2) == ":":
                        found[m.group(1)] = m.end()
                    else:
                        found[m.group(1)] = "shorthand"
        i += 1
    return found


def _literal_value(src, mask, i, end):
    """Value at i: literal parts when the whole value is ONE literal, else None."""
    i = _skip_ws(src, mask, i)
    parts, j = _read_literal(src, mask, i)
    if parts is None:
        return None
    j = _skip_ws(src, mask, j)
    m = _AS_CONST_RE.match(src, j)
    if m:
        j = _skip_ws(src, mask, m.end())
    if j <= end and src[j] in ",}":
        return parts
    return None


_AS_CONST_RE = re.compile(r"as\s+const\b")


_CALL_RE = re.compile(r"(?<![\w$.])("
                      + "|".join(sorted(WRAPPERS, key=len, reverse=True)) + r"|fetch)\b")


def extract_calls(src):
    """Return (calls, unresolved). calls: list of (method, parts, line); unresolved:
    list of (line, reason) for in-scope wrapper calls whose url/method is not literal."""
    mask = code_mask(src)
    calls, unresolved = [], []
    for m in _CALL_RE.finditer(src):
        if mask[m.start()] != 1 or re.search(r"function\s*$", src[max(0, m.start() - 20):m.start()]):
            continue  # not code, or the wrapper's own definition
        name = m.group(1)
        line = src.count("\n", 0, m.start()) + 1
        i = _skip_ws(src, mask, m.end())
        if i < len(src) and src[i] == "<" and name != "fetch":
            depth = 0
            while i < len(src):
                if src[i] == "<":
                    depth += 1
                elif src[i] == ">" and src[i - 1] != "=":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            i = _skip_ws(src, mask, i)
        if i >= len(src) or src[i] != "(":
            continue  # a reference (import, JSDoc link), not a call
        a = _skip_ws(src, mask, i + 1)
        if name == "fetch":
            parts, j = _read_literal(src, mask, a)
            if parts is None or not parts[0][0] == "text" or not parts[0][1].startswith("/api/"):
                continue  # out of scope: not a literal API URL
            j = _skip_ws(src, mask, j)
            method_parts = [("text", "GET")]
            if src[j] == ",":
                o = _skip_ws(src, mask, j + 1)
                if src[o] == "{":
                    oc = _matching_close(src, mask, o)
                    props = _object_props(src, mask, o, oc, ("method",))
                    if "method" in props:
                        mv = props["method"]
                        method_parts = None if mv == "shorthand" else _literal_value(src, mask, mv, oc)
            if method_parts is None or len(method_parts) != 1 or method_parts[0][0] != "text":
                unresolved.append((line, "raw fetch with a non-literal method"))
                continue
            calls.append((method_parts[0][1].upper(), parts, line))
            continue
        if src[a] != "{":
            unresolved.append((line, f"{name} argument is not an object literal"))
            continue
        oc = _matching_close(src, mask, a)
        props = _object_props(src, mask, a, oc, ("url", "method"))
        url = props.get("url")
        method = props.get("method")
        url_parts = None if url in (None, "shorthand") else _literal_value(src, mask, url, oc)
        method_parts = None if method in (None, "shorthand") else _literal_value(src, mask, method, oc)
        if url_parts is None:
            unresolved.append((line, f"{name} url is not a string/template literal"))
            continue
        if method_parts is None or len(method_parts) != 1 or method_parts[0][0] != "text":
            unresolved.append((line, f"{name} method is not a string literal"))
            continue
        calls.append((method_parts[0][1].upper(), url_parts, line))
    return calls, unresolved


# ------------------------------------------------------------------ normalisation


def normalise(parts):
    """Literal parts -> normalised path string (placeholders as PLACEHOLDER)."""
    s = "".join(PLACEHOLDER if kind == "expr" else text for kind, text in parts)
    q = s.find("?")
    if q >= 0:
        s = s[:q]
    # A trailing placeholder glued to literal text of its own segment is a query suffix.
    while s.endswith(PLACEHOLDER) and len(s) >= 2 and s[-2] not in ("/", PLACEHOLDER):
        s = s[:-1]
    # Placeholders that share a segment collapse into one.
    while PLACEHOLDER * 2 in s:
        s = s.replace(PLACEHOLDER * 2, PLACEHOLDER)
    if len(s) > 1 and s.endswith("/"):
        s = s.rstrip("/") or "/"
    return s


def render(path):
    return path.replace(PLACEHOLDER, PLACEHOLDER_TEXT)


# ------------------------------------------------------------------ OpenAPI paths

_PATH_KEY_RE = re.compile(r"^  '(/[^']*)': \{$")
_METHOD_RE = re.compile(r"^    (" + "|".join(HTTP_METHODS) + r"): ")


def load_spec(text):
    """{path: set(METHODS)} from the `paths` interface of openapi.d.ts."""
    start = text.find("export interface paths {")
    if start < 0:
        raise ValueError("no `export interface paths` in the OpenAPI types")
    spec = {}
    current = None
    for line in text[start:].splitlines()[1:]:
        if line == "}":
            break
        m = _PATH_KEY_RE.match(line)
        if m:
            current = spec.setdefault(m.group(1), set())
            continue
        m = _METHOD_RE.match(line)
        if m and current is not None:
            current.add(m.group(1).upper())
    return spec


def _segment_matches(call_seg, spec_seg):
    if call_seg == spec_seg:
        return True
    # A whole-segment parameter ({id}) matches only a console placeholder ({*}): a literal sub-resource such as
    # '/notifications/rules' must not pass as '/notifications/{id}' just because the method exists there (#418 shape).
    if re.fullmatch(r"\{[^}]*\}", spec_seg):
        return call_seg in (PLACEHOLDER, PLACEHOLDER_TEXT)
    if "{" in spec_seg:
        rx = "".join("[^/]+" if tok.startswith("{") else re.escape(tok)
                     for tok in re.split(r"(\{[^}]*\})", spec_seg) if tok)
        return re.fullmatch(rx, call_seg) is not None
    return False


def _specificity(spec_path):
    return tuple(0 if re.fullmatch(r"\{[^}]*\}", seg) else 1 if "{" in seg else 2
                 for seg in spec_path.split("/"))


def classify(method, path, spec):
    """None when declared, else "no-path" or "method-mismatch"."""
    call_segs = path.split("/")
    matched = [p for p in spec
               if len(p.split("/")) == len(call_segs)
               and all(_segment_matches(c, s) for c, s in zip(call_segs, p.split("/")))]
    if not matched:
        return "no-path"
    # The most specific matching path decides: a literal segment beats a parameter, so a
    # call to /routes/reorder is judged against /routes/reorder, never /routes/{id}.
    best = max(_specificity(p) for p in matched)
    matched = [p for p in matched if _specificity(p) == best]
    if any(method in spec[p] for p in matched):
        return None
    return "method-mismatch"


# ------------------------------------------------------------------------- driver


def source_files(root):
    out = []
    gen = os.path.join(root, GENERATED_DIR)
    for base, dirs, files in os.walk(os.path.join(root, SRC_DIR)):
        if os.path.abspath(base).startswith(os.path.abspath(gen)):
            continue
        dirs.sort()
        for name in sorted(files):
            if re.search(r"\.(ts|tsx)$", name) and not re.search(r"\.test\.(ts|tsx)$", name):
                out.append(os.path.join(base, name))
    return out


def fail(msg):
    print(f"::error::api-routes: {msg}")


def main(argv):
    root = argv[1] if len(argv) > 1 else os.getcwd()
    with open(os.path.join(root, OPENAPI_FILE), encoding="utf-8") as handle:
        spec = load_spec(handle.read())
    with open(os.path.join(root, BASELINE_FILE), encoding="utf-8") as handle:
        baseline_doc = json.load(handle)
    baseline = {(e["method"], e["path"], e["file"]): e for e in baseline_doc["entries"]}
    min_calls = int(baseline_doc["min_scanned_calls"])

    total = 0
    violations = {}  # key -> kind
    unresolved = []
    for f in source_files(root):
        rel = os.path.relpath(f, root).replace(os.sep, "/")
        with open(f, encoding="utf-8") as handle:
            calls, unres = extract_calls(handle.read())
        unresolved += [(rel, line, why) for line, why in unres]
        for method, parts, line in calls:
            total += 1
            path = normalise(parts)
            kind = classify(method, path, spec)
            if kind:
                violations.setdefault((method, render(path), rel), (kind, line))

    failed = False
    if total < min_calls:
        failed = True
        fail(f"scanned only {total} API call(s), below min_scanned_calls={min_calls}: "
             "the scan is mis-wired (wrong root, renamed client wrapper) and would pass vacuously.")

    new = sorted(k for k in violations if k not in baseline)
    if new:
        failed = True
        fail(f"{len(new)} console API call(s) name a route {OPENAPI_FILE} does not declare. "
             "Fix the call, or map the route in Platform and regenerate the types "
             "(npm run generate:api-types):")
        for k in new:
            kind, line = violations[k]
            print(f"  {kind}: {k[0]} {k[1]}  ({k[2]}:{line})")

    stale = sorted(k for k in baseline if k not in violations)
    if stale:
        failed = True
        fail(f"{len(stale)} baseline entr(y/ies) in {BASELINE_FILE} no longer occur "
             "(the call was fixed, removed or moved). Remove them — the baseline only shrinks:")
        for k in stale:
            print(f"  {k[0]} {k[1]}  ({k[2]})")

    for k, (kind, line) in sorted(violations.items()):
        if k in baseline:
            print(f"  baselined {kind}: {k[0]} {k[1]}  ({k[2]}:{line}) — {baseline[k].get('note', '')}")
    print(f"API routes: {total} call(s) checked against {len(spec)} documented path(s); "
          f"{len(violations)} undeclared (baseline {len(baseline)}); "
          f"{len(unresolved)} unresolved (non-literal url/method, not checked).")
    if os.environ.get("API_ROUTES_VERBOSE"):
        for rel, line, why in unresolved:
            print(f"  unresolved: {rel}:{line} {why}")
    if not failed:
        print("API routes OK.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
