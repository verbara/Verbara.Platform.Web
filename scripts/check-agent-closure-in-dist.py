#!/usr/bin/env python3
"""Fail CI when the first load of the agent console stops being its own (ADR-0014).

Usage: check-agent-closure-in-dist.py <dist-dir> [--report]

The console stays in the single SPA, so nothing but this check keeps
/agent/conversation/:id from paying for other domains: a bundler default once put
vendor-charts and vendor-pdf in its entry, and a global size budget let it through.
The closure is the entry script of dist/index.html plus the agent-layout-* and
conversation-view-* chunks, following static imports only. Over it:

  * no module from src/admin, src/analytics or src/operations, nor from recharts,
    jspdf, jspdf-autotable, html2canvas, ag-grid* or @xyflow, read from each
    chunk's source map, because a module bundled into the entry has no file name;
  * no chunk named vendor-(charts|pdf|grid|flow)-*, a second, independent signal;
  * at most 500,000 B: the closure plus the entry stylesheet, each file gzipped alone
    at level 9, then summed. size-limit takes file globs and cannot follow a closure;
  * it fails, never passes, when it cannot measure: no dist, no entry script, no
    stylesheet, a root that matches no chunk, a static import that is not in dist, or
    a chunk without a readable source map (only rolldown-runtime-* may have none, it
    holds no application source).

--report adds the route table, measured the same way, for the growth comparison of a
chunking change. The checks still run and still set the exit code.

Stdlib only. Exit codes: 0 = pass, 1 = a check failed.
"""
import functools
import gzip
import json
import os
import posixpath
import re
import sys
from html.parser import HTMLParser

BUDGET_BYTES = 500_000

# The first row is the route the checks guard; its stems are the closure roots.
ROUTES = (
    ("/agent/conversation/:id", ("agent-layout", "conversation-view")),
    ("analytics dashboard", ("analytics-layout", "dashboard-page")),
    ("CDR", ("analytics-layout", "cdr-page")),
    ("flow designer", ("admin-layout", "flow-designer")),
    ("operations", ("operations-layout",)),
)

FORBIDDEN_DOMAIN = re.compile(r"(?:^|/)src/(admin|analytics|operations)/")
FORBIDDEN_VENDOR = re.compile(
    r"(?:^|/)node_modules/(recharts|jspdf|jspdf-autotable|html2canvas|ag-grid[^/]*|@xyflow)/"
)
FORBIDDEN_CHUNK = re.compile(r"^vendor-(charts|pdf|grid|flow)-")
RUNTIME_CHUNK = re.compile(r"^rolldown-runtime-[\w-]+\.js$")

# Minified `from"./x.js"` and `import"./x.js"`. `import("./x.js")` does not match: a
# dynamic import is not part of the first load. Scans the whole file, because
# __vite__mapDeps precedes the imports of the entry and lists every lazy chunk as a
# plain string, which matches neither form.
STATIC_IMPORT = re.compile(r"""\b(?:from|import)\s*(["'])(\.{0,2}/[^"'\s]+?)\1""")


class _EntryAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.stylesheets = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"):
            self.scripts.append(a["src"])
        elif tag == "link" and (a.get("rel") or "").lower() == "stylesheet" and a.get("href"):
            self.stylesheets.append(a["href"])


def _dist_rel(url):
    return posixpath.normpath(url.lstrip("/").split("?", 1)[0])


def _root_chunks(dist, stems, failures):
    """Each stem's [name]-[hash].js in assets/, so a stem cannot match a longer name."""
    assets = os.path.join(dist, "assets")
    names = sorted(os.listdir(assets)) if os.path.isdir(assets) else []
    roots = []
    for stem in stems:
        pattern = re.compile(rf"^{re.escape(stem)}-[\w-]{{8}}\.js$")
        matches = [f"assets/{name}" for name in names if pattern.match(name)]
        if not matches:
            failures.append(f"root {stem}-*: no chunk matches it, the closure cannot be established")
        roots.extend(matches)
    return roots


def _closure(dist, roots, failures):
    """Every chunk reachable from roots through static imports."""
    closure = set()
    pending = [(root, "index.html") for root in roots]
    while pending:
        rel, importer = pending.pop()
        if rel in closure:
            continue
        path = os.path.join(dist, rel)
        if rel.startswith("..") or not os.path.isfile(path):
            failures.append(f"{rel}: imported by {importer} but missing from dist")
            continue
        closure.add(rel)
        with open(path, "rb") as handle:
            text = handle.read().decode("utf-8", "replace")
        for match in STATIC_IMPORT.finditer(text):
            specifier = match.group(2)
            if specifier.startswith("/"):
                target = _dist_rel(specifier)
            else:
                target = posixpath.normpath(posixpath.join(posixpath.dirname(rel), specifier))
            pending.append((target, rel))
    return closure


def _origins(dist, rel, failures):
    """The chunk's modules as repo-relative paths, or None when they cannot be read."""
    map_rel = f"{rel}.map"
    if not os.path.isfile(os.path.join(dist, map_rel)):
        if RUNTIME_CHUNK.match(posixpath.basename(rel)):
            return []
        failures.append(f"{rel}: no source map, cannot read the origin of this chunk")
        return None
    try:
        with open(os.path.join(dist, map_rel), encoding="utf-8") as handle:
            sources = json.load(handle)["sources"]
    except (ValueError, KeyError, TypeError):
        sources = None
    if not sources or not isinstance(sources, list) or not all(isinstance(s, str) for s in sources):
        failures.append(f"{map_rel}: unreadable, cannot read the origin of this chunk")
        return None
    base = posixpath.join("dist", posixpath.dirname(rel))
    return [posixpath.normpath(posixpath.join(base, source)) for source in sources]


def _forbidden_group(module):
    vendor = FORBIDDEN_VENDOR.search(module)
    if vendor:
        return f"node_modules/{vendor.group(1)}/"
    if "node_modules/" in module:
        return None
    domain = FORBIDDEN_DOMAIN.search(module)
    return f"src/{domain.group(1)}/" if domain else None


def _check_origins(dist, closure, failures):
    for rel in sorted(closure):
        if FORBIDDEN_CHUNK.match(posixpath.basename(rel)):
            failures.append(f"{rel}: forbidden chunk name in the /agent closure")
        origins = _origins(dist, rel, failures)
        if origins is None:
            continue
        hits = {}
        for module in origins:
            group = _forbidden_group(module)
            if group:
                hits.setdefault(group, []).append(module)
        for group, listed in sorted(hits.items()):
            if group.startswith("node_modules/") and len(listed) > 1:
                listed = [f"{listed[0]} and {len(listed) - 1} more from {group}"]
            for module in listed:
                failures.append(f"{rel}: forbidden module {module}")


@functools.lru_cache(maxsize=None)
def _gzip9(path):
    with open(path, "rb") as handle:
        return len(gzip.compress(handle.read(), compresslevel=9, mtime=0))


def _measure(dist, closure, stylesheets):
    return sum(_gzip9(os.path.join(dist, rel)) for rel in [*closure, *stylesheets])


def check(dist, report=False):
    failures = []
    found = []
    rows = []

    if not os.path.isdir(dist):
        return [f"{dist} is not a directory (run npm run build:all first)"], found, rows
    page = os.path.join(dist, "index.html")
    if not os.path.isfile(page):
        return ["index.html is missing"], found, rows

    parser = _EntryAssets()
    with open(page, encoding="utf-8") as handle:
        parser.feed(handle.read())
    entry = [_dist_rel(url) for url in parser.scripts]
    if not entry:
        failures.append("index.html: no entry script, the closure cannot be established")
    stylesheets = [_dist_rel(url) for url in parser.stylesheets]
    if not stylesheets:
        failures.append("index.html: no stylesheet link, the budget would undercount")
    for rel in stylesheets:
        if not os.path.isfile(os.path.join(dist, rel)):
            failures.append(f"{rel}: linked by index.html but missing from dist")

    closure = _closure(dist, [*entry, *_root_chunks(dist, ROUTES[0][1], failures)], failures)
    measurable = not failures
    if measurable:
        found.append(f"closure: {len(closure)} chunks from {len(entry) + len(ROUTES[0][1])} roots")
    _check_origins(dist, closure, failures)

    if measurable:
        total = _measure(dist, closure, stylesheets)
        line = f"{total:,} B gzip-9 ({len(closure)} chunks, {len(stylesheets)} stylesheet)"
        if total > BUDGET_BYTES:
            failures.append(f"budget: {line} is over the {BUDGET_BYTES:,} B limit")
        else:
            found.append(f"budget: {line} is within the {BUDGET_BYTES:,} B limit")

    if report:
        for route, stems in ROUTES:
            problems = []
            route_closure = _closure(dist, [*entry, *_root_chunks(dist, stems, problems)], problems)
            failures.extend(p for p in problems if p not in failures)
            if not problems and stylesheets and measurable:
                rows.append((route, len(route_closure), _measure(dist, route_closure, stylesheets)))

    return failures, found, rows


def main(argv):
    args = argv[1:]
    report = "--report" in args
    if report:
        args.remove("--report")
    if len(args) != 1:
        print("usage: check-agent-closure-in-dist.py <dist-dir> [--report]", file=sys.stderr)
        return 1
    failures, found, rows = check(args[0], report)
    for line in found:
        print(f"ok   {line}")
    for failure in failures:
        print(f"FAIL {failure}")
    if rows:
        print("| Route | Chunks | gzip-9 B |")
        print("|-------|--------|----------|")
        for route, chunks, total in rows:
            print(f"| {route} | {chunks} | {total:,} |")
    if failures:
        print(f"check-agent-closure-in-dist: {len(failures)} problem(s) in {args[0]}")
        return 1
    print(f"check-agent-closure-in-dist: the /agent closure is clean and within budget in {args[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
