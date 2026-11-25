#!/usr/bin/env python3
"""Fail CI on a new type error in a unit test file, or on a stale baseline entry (#572).

Usage: check-test-types.py [repo-root]

vitest strips types without checking them, and `tsconfig.app.json` excludes every test
file, so before #572 no TypeScript project checked the unit tests: a test could call a
function with the wrong arguments, or mock a hook with the wrong shape, and still pass.
`tsconfig.test.json` covers them (src/**/*.test.*, src/test, tests/unit). It is not yet
referenced from `tsconfig.json`, because `tsc -b` would fail on the errors that already
exist; this check carries them instead, in unit-test-types-baseline.json.

It runs `tsc -p <tsconfig> --noEmit --pretty false --listFiles` from repo-root and counts
the errors per (file, error code). Line numbers are not part of the key, so an edit that
moves an existing error does not trip the check.
  new    a (file, code) with more errors than the baseline allows (absent = 0) — every
         diagnostic of that key is printed, since the new one cannot be told apart;
  stale  a (file, code) with fewer errors than the baseline says: lower the count to
         what the message prints (or delete the entry at 0). The baseline only SHRINKS.
Never add an entry for a new error; fix the test. When the baseline is empty, reference
tsconfig.test.json from tsconfig.json and retire this check.

Liveness: every test file vitest collects (*.test|spec.ts|tsx under "test_roots", outside
"not_unit_test_dirs" and node_modules) must be in tsc's file list, and there must be at
least "min_checked_test_files" of them; a global compiler error (a bad tsconfig) or a
non-zero tsc exit without diagnostics fails too, so the check cannot pass vacuously.

TEST_TYPES_TSC overrides the compiler (default <repo-root>/node_modules/.bin/tsc).
Dependency-free (stdlib only). Exit 0 = pass, 1 = new error, stale entry or liveness trip.
"""
import json
import os
import re
import subprocess
import sys

BASELINE_FILE = "unit-test-types-baseline.json"
_DIAGNOSTIC = re.compile(r"^(?P<file>\S[^(]*)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+): ")
_GLOBAL_ERROR = re.compile(r"^error (TS\d+): ")
_TEST_FILE = re.compile(r"\.(test|spec)\.tsx?$")


def fail(message):
    print(f"::error::test-types: {message}")
    sys.exit(1)


def load_baseline(root):
    path = os.path.join(root, BASELINE_FILE)
    try:
        with open(path, encoding="utf-8") as handle:
            baseline = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read baseline '{path}': {exc}")
    for key in ("tsconfig", "min_checked_test_files", "test_roots", "errors"):
        if key not in baseline:
            fail(f"baseline '{path}' has no \"{key}\" key.")
    return baseline


def collected_test_files(root, baseline):
    """The test files vitest collects, relative to root with forward slashes."""
    skipped = [d.rstrip("/") + "/" for d in baseline.get("not_unit_test_dirs", [])]
    found = set()
    for test_root in baseline["test_roots"]:
        for base, dirs, files in os.walk(os.path.join(root, test_root)):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for name in files:
                if not _TEST_FILE.search(name):
                    continue
                rel = os.path.relpath(os.path.join(base, name), root).replace(os.sep, "/")
                if not any(rel.startswith(d) for d in skipped):
                    found.add(rel)
    return found


def run_tsc(root, tsconfig):
    tsc = os.environ.get("TEST_TYPES_TSC") or os.path.join(root, "node_modules", ".bin", "tsc")
    try:
        proc = subprocess.run(
            [tsc, "-p", tsconfig, "--noEmit", "--pretty", "false", "--listFiles"],
            cwd=root, capture_output=True, text=True,
        )
    except OSError as exc:
        fail(f"cannot run tsc '{tsc}': {exc}")
    return proc.returncode, (proc.stdout + proc.stderr).splitlines()


def main(argv):
    root = os.path.abspath(argv[1] if len(argv) > 1 else os.getcwd())
    baseline = load_baseline(root)
    rc, lines = run_tsc(root, baseline["tsconfig"])

    diagnostics = {}  # (file, code) -> [line, ...]
    checked = set()
    root_prefix = root.rstrip(os.sep) + os.sep
    for line in lines:
        match = _DIAGNOSTIC.match(line)
        if match:
            key = (match["file"].replace(os.sep, "/"), match["code"])
            diagnostics.setdefault(key, []).append(line)
            continue
        match = _GLOBAL_ERROR.match(line)
        if match:
            fail(f"tsc reported a global error, the project is mis-wired: {line}")
        if line.startswith(root_prefix) and f"{os.sep}node_modules{os.sep}" not in line[len(root):]:
            checked.add(os.path.relpath(line, root).replace(os.sep, "/"))

    if rc != 0 and not diagnostics:
        tail = "\n".join(lines[-20:])
        fail(f"tsc exited {rc} without a file diagnostic; its output ends:\n{tail}")

    collected = collected_test_files(root, baseline)
    missing = sorted(collected - checked)
    if missing:
        fail(f"{len(missing)} test file(s) vitest collects are not type-checked by "
             f"{baseline['tsconfig']} (widen its \"include\"):\n  " + "\n  ".join(missing))
    checked_tests = len(collected & checked)
    floor = int(baseline["min_checked_test_files"])
    if checked_tests < floor:
        fail(f"liveness: tsc checked {checked_tests} test files, below the floor {floor} — "
             f"the scan is mis-wired (wrong root, tsconfig or test_roots).")

    allowed = {}
    for rel, codes in baseline["errors"].items():
        for code, count in codes.items():
            allowed[(rel, code)] = int(count)

    new, stale = [], []
    for key in sorted(set(allowed) | set(diagnostics)):
        now = len(diagnostics.get(key, []))
        was = allowed.get(key, 0)
        if now > was:
            new.append((key, now, was))
        elif now < was:
            stale.append((key, now, was))

    total = sum(len(v) for v in diagnostics.values())
    print(f"Unit-test type errors: {total} (baseline {sum(allowed.values())}) over "
          f"{checked_tests} type-checked test files ({baseline['tsconfig']})")

    if new:
        print(f"::error::test-types: new type error(s) in {len(new)} (file, code) pair(s). "
              f"Fix the test; never add a baseline entry for a new error.")
        for (rel, code), now, was in new:
            print(f"  {rel}: {now} {code} (baseline {was})")
            for line in diagnostics[(rel, code)]:
                print(f"    {line}")
    if stale:
        print(f"::error::test-types: {len(stale)} stale baseline entr(y/ies) in "
              f"{BASELINE_FILE} — the errors were fixed, so lower the count (delete at 0):")
        for (rel, code), now, was in stale:
            print(f"  {rel} {code}: baseline {was}, now {now}")
    if new or stale:
        return 1
    print("Unit-test type baseline OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
