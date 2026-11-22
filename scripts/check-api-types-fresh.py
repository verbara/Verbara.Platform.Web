#!/usr/bin/env python3
"""Compare the committed openapi.d.ts with the one regenerated from Platform's document.

Usage: check-api-types-fresh.py <committed.d.ts> <regenerated.d.ts>

Both files must already be formatted with this repo's prettier configuration (the
api-types-freshness workflow formats both sides before calling this). The comparison is
by declaration block, so a failure names what changed instead of printing a raw diff of
~22,000 lines (change generated-types-follow-platform-main, design D5):

  * one block per `paths` entry (`'/api/…': {` at 2 spaces), split further into its
    members at 4 spaces (`get`, `post`, `parameters`, …) so a change names the method;
  * one block per member of `components.schemas` (any member at 4 spaces: `Name: {`,
    `Name: 'A' | 'B';`, `Name: unknown;`, or `Name:` with the value on the next line);
  * one block for the rest of the file.

A leading JSDoc belongs to the member that follows it, never to the one above it. The
last schema ends where `schemas` closes, not where `components` closes.

Exit codes: 0 and `fresh` when the files are equal; 1 and the list of changed keys when
they differ; 2 on malformed input (a file with no `paths` block, or no file). An empty
parse never passes. Stdlib only — NO pip deps (ADR-0013).
"""
import re
import sys

# A member at exactly 4 spaces: `Name:`, `Name?:`, `'quoted-name':`, value or not.
_MEMBER4 = re.compile(r"^    (?:'([^']+)'|([A-Za-z_$][\w$]*))\??:")
_PATH = re.compile(r"^  '([^']+)': \{$")
_HTTP_METHODS = ("get", "put", "post", "delete", "options", "head", "patch", "trace")


class Malformed(Exception):
    pass


def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().splitlines()
    except OSError as exc:
        raise Malformed(f"cannot read {path}: {exc}") from exc


def _find(lines, start, predicate):
    for i in range(start, len(lines)):
        if predicate(lines[i]):
            return i
    return None


def _split_members(lines, member_re):
    """Split a run of lines into (key, block lines) by member start lines.

    A JSDoc opened at the members' indent (`/**` there) is held back and attached to
    the member that follows it. Lines before the first member (and an unattached
    trailing comment) go under the key None.
    """
    blocks = {}
    order = []
    current = None
    pending = []
    in_doc = False
    indent = None

    def add(key, chunk):
        if key not in blocks:
            blocks[key] = []
            order.append(key)
        blocks[key].extend(chunk)

    for line in lines:
        match = member_re.match(line)
        if in_doc:
            pending.append(line)
            if "*/" in line:
                in_doc = False
            continue
        if match:
            key = match.group(1) or match.group(2)
            if indent is None:
                indent = len(line) - len(line.lstrip(" "))
            current = key
            add(current, pending + [line])
            pending = []
            continue
        stripped = line.lstrip(" ")
        line_indent = len(line) - len(stripped)
        if stripped.startswith("/**") and (indent is None or line_indent == indent):
            pending.append(line)
            in_doc = "*/" not in stripped[3:]
            continue
        if pending:
            # A comment followed by something other than a member stays where it was.
            add(current, pending)
            pending = []
        add(current, [line])
    if pending:
        add(current, pending)
    return blocks


def _parse(path):
    lines = _read(path)
    p_start = _find(lines, 0, lambda l: l == "export interface paths {")
    if p_start is None:
        raise Malformed(f"{path}: no `export interface paths {{` block")
    p_end = _find(lines, p_start + 1, lambda l: l == "}")
    if p_end is None:
        raise Malformed(f"{path}: the `paths` block never closes")
    path_blocks = _split_members(lines[p_start + 1 : p_end], _PATH)
    path_blocks.pop(None, None)
    if not path_blocks:
        raise Malformed(f"{path}: the `paths` block declares no route")

    blocks = {}
    for route, body in path_blocks.items():
        # body holds the leading JSDoc, the `'/api/…': {` line, the members and `  };`.
        # The route key holds everything but its HTTP methods; each method is its own key,
        # so a changed operation is named `POST /api/…`.
        members = _split_members(body, _MEMBER4)
        blocks[("route", route)] = []
        for member, chunk in members.items():
            if member in _HTTP_METHODS:
                blocks[("route", f"{member.upper()} {route}")] = chunk
            else:
                blocks[("route", route)].extend(chunk)

    remainder = lines[:p_start] + ["<paths>"]
    s_start = _find(lines, p_end + 1, lambda l: l == "  schemas: {")
    if s_start is None:
        remainder += lines[p_end + 1 :]
    else:
        s_end = _find(lines, s_start + 1, lambda l: l == "  };")
        if s_end is None:
            raise Malformed(f"{path}: `components.schemas` never closes")
        schemas = _split_members(lines[s_start + 1 : s_end], _MEMBER4)
        stray = schemas.pop(None, None)
        for name, chunk in schemas.items():
            blocks[("schema", name)] = chunk
        remainder += lines[p_end + 1 : s_start + 1] + (stray or []) + ["<schemas>"] + lines[s_end:]
    blocks[("file", "remainder")] = remainder
    return blocks


def _describe(kind, key):
    return "file remainder" if kind == "file" else f"{kind}: {key}"


def main(argv):
    if len(argv) != 3:
        print("usage: check-api-types-fresh.py <committed.d.ts> <regenerated.d.ts>", file=sys.stderr)
        return 2
    committed_path, regenerated_path = argv[1], argv[2]
    try:
        committed = _parse(committed_path)
        regenerated = _parse(regenerated_path)
    except Malformed as exc:
        print(f"malformed: {exc}", file=sys.stderr)
        return 2

    changes = []
    # A route on one side only is reported once, by its path, not once per method.
    one_sided = {k[1] for k in set(committed) ^ set(regenerated) if k[0] == "route" and " " not in k[1]}
    # Routes first, then schemas, then the remainder; each group in key order.
    keys = sorted(set(committed) | set(regenerated), key=lambda k: ({"route": 0, "schema": 1}.get(k[0], 2), k[1]))
    for key in keys:
        old, new = committed.get(key), regenerated.get(key)
        if key[0] == "route" and " " in key[1] and key[1].split(" ", 1)[1] in one_sided:
            continue
        if old == new:
            continue
        if old is None:
            changes.append(f"added {_describe(*key)}")
        elif new is None:
            changes.append(f"removed {_describe(*key)}")
        else:
            changes.append(f"changed {_describe(*key)}")

    # Exit code follows file equality, so a splitter blind spot can name the wrong block
    # but can never pass a stale copy.
    with open(committed_path, encoding="utf-8") as a, open(regenerated_path, encoding="utf-8") as b:
        equal = a.read() == b.read()
    if equal:
        print("fresh")
        return 0
    if not changes:
        changes.append("changed file remainder")
    print(f"stale: {len(changes)} declaration(s) differ")
    for line in changes:
        print(line)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
