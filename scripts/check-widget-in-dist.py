#!/usr/bin/env python3
"""Fail CI when the built dist/ does not carry the WebChat widget (#429).

Usage: check-widget-in-dist.py <dist-dir>

The image serves dist/ as it is (Dockerfile), so whatever `npm run build:all` leaves
in dist/ is what ships. The widget is built into public/webchat/ (gitignored) and
reaches dist/ only when vite's public/ copy runs after it; a build that runs the
console first, or not at all, still exits 0 and ships an image without the widget.
This script checks the tree itself, without Docker:

  * webchat/v1/verbara-webchat.js       the SDK bundle host pages load, non-empty;
  * webchat/embed/index.html            the iframe page;
  * its module script and its stylesheet, both under /webchat/embed/ and present
    in dist/, non-empty (a page without a stylesheet renders unstyled; a page
    still pointing at ./main.tsx was never built);
  * no *.map anywhere under webchat/   the widget ships without sourcemaps. The
    console's own maps under assets/ are not this script's concern.

Stdlib only. Exit codes: 0 = pass, 1 = a check failed.
"""
import os
import sys
from html.parser import HTMLParser

SDK = "webchat/v1/verbara-webchat.js"
EMBED_PAGE = "webchat/embed/index.html"
EMBED_PREFIX = "/webchat/embed/"


class _EmbedAssets(HTMLParser):
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


def _non_empty(dist, rel):
    path = os.path.join(dist, rel)
    return os.path.isfile(path) and os.path.getsize(path) > 0


def _check_asset(dist, kind, url, failures, found):
    if not url.startswith(EMBED_PREFIX):
        failures.append(f"{EMBED_PAGE}: {kind} {url} is not under {EMBED_PREFIX} (not a built asset)")
        return
    rel = url.lstrip("/").split("?", 1)[0]
    if _non_empty(dist, rel):
        found.append(rel)
    else:
        failures.append(f"{EMBED_PAGE}: {kind} {rel} is missing or empty in dist")


def check(dist):
    failures = []
    found = []

    if not os.path.isdir(dist):
        return [f"{dist} is not a directory (run npm run build:all first)"], found

    if _non_empty(dist, SDK):
        found.append(SDK)
    else:
        failures.append(f"{SDK} is missing or empty")

    page = os.path.join(dist, EMBED_PAGE)
    if not os.path.isfile(page):
        failures.append(f"{EMBED_PAGE} is missing")
    else:
        found.append(EMBED_PAGE)
        parser = _EmbedAssets()
        with open(page, encoding="utf-8") as handle:
            parser.feed(handle.read())
        if not parser.scripts:
            failures.append(f"{EMBED_PAGE}: no module script")
        for url in parser.scripts:
            _check_asset(dist, "script", url, failures, found)
        if not parser.stylesheets:
            failures.append(f"{EMBED_PAGE}: no stylesheet link (the widget would render unstyled)")
        for url in parser.stylesheets:
            _check_asset(dist, "stylesheet", url, failures, found)

    webchat = os.path.join(dist, "webchat")
    for base, _dirs, files in os.walk(webchat):
        for name in sorted(files):
            if name.endswith(".map"):
                rel = os.path.relpath(os.path.join(base, name), dist).replace(os.sep, "/")
                failures.append(f"{rel}: sourcemap under webchat/ would ship in the image")

    return failures, found


def main(argv):
    if len(argv) != 2:
        print("usage: check-widget-in-dist.py <dist-dir>", file=sys.stderr)
        return 1
    failures, found = check(argv[1])
    for rel in found:
        print(f"ok   {rel}")
    for failure in failures:
        print(f"FAIL {failure}")
    if failures:
        print(f"check-widget-in-dist: {len(failures)} problem(s) in {argv[1]}")
        return 1
    print(f"check-widget-in-dist: the WebChat widget is complete in {argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
