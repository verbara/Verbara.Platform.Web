"""Unit tests for check-test-types.py (the unit-test type-check baseline, #572).

Builds tmp repo trees with a stub `tsc` (a script that prints canned compiler output and
exits with a chosen code) plus baseline fixtures, and runs the check as a subprocess.
Stdlib unittest only — NO pip deps (ADR-0013).
"""
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, os.pardir, "check-test-types.py")
_REPO = os.path.abspath(os.path.join(_HERE, os.pardir, os.pardir))

_TEST_FILES = ("src/a/one.test.ts", "src/a/two.test.tsx", "tests/unit/b/three.test.tsx")


class CheckTestTypesTests(unittest.TestCase):
    def setUp(self):
        self._root = tempfile.mkdtemp()
        for rel in _TEST_FILES + ("src/a/one.ts", "tests/e2e/flow.spec.ts"):
            self._touch(rel)

    def tearDown(self):
        shutil.rmtree(self._root)

    def _touch(self, rel):
        path = os.path.join(self._root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("export {};\n")

    def _baseline(self, errors, min_files=3, **extra):
        doc = {
            "tsconfig": "tsconfig.test.json",
            "min_checked_test_files": min_files,
            "test_roots": ["src", "tests"],
            "not_unit_test_dirs": ["tests/e2e"],
            "errors": errors,
        }
        doc.update(extra)
        with open(os.path.join(self._root, "unit-test-types-baseline.json"), "w",
                  encoding="utf-8") as handle:
            json.dump(doc, handle)

    def _listed(self, rels=_TEST_FILES):
        lines = [os.path.join(self._root, rel) for rel in rels]
        # Files outside the tree under test never count as checked test files.
        lines.append("/elsewhere/node_modules/typescript/lib/lib.es2023.d.ts")
        lines.append(os.path.join(self._root, "node_modules", "x", "y.test.ts"))
        return lines

    def _run(self, diagnostics, exit_code=2, listed=None, tsc_env=True):
        out = os.path.join(self._root, "tsc-out.txt")
        with open(out, "w", encoding="utf-8") as handle:
            handle.write("\n".join(diagnostics + (self._listed() if listed is None else listed)))
            handle.write("\n")
        stub = os.path.join(self._root, "stub-tsc")
        with open(stub, "w", encoding="utf-8") as handle:
            handle.write(f"#!/bin/sh\necho \"$@\" > '{self._root}/tsc-args.txt'\n"
                         f"cat '{out}'\nexit {exit_code}\n")
        os.chmod(stub, os.stat(stub).st_mode | stat.S_IEXEC)
        env = dict(os.environ)
        env.pop("TEST_TYPES_TSC", None)
        if tsc_env:
            env["TEST_TYPES_TSC"] = stub
        return subprocess.run([sys.executable, _SCRIPT, self._root],
                              capture_output=True, text=True, env=env)

    def _assert_fails(self, result, *needles):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        for needle in needles:
            self.assertIn(needle, result.stdout)

    def test_ShouldPass_WhenErrorsEqualBaseline(self):
        self._baseline({"src/a/one.test.ts": {"TS2532": 2}})
        result = self._run([
            "src/a/one.test.ts(3,1): error TS2532: Object is possibly 'undefined'.",
            "src/a/one.test.ts(9,4): error TS2532: Object is possibly 'undefined'.",
        ])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Unit-test type baseline OK.", result.stdout)

    def test_ShouldPassTscTheTestProjectWithoutEmit_WhenRun(self):
        self._baseline({})
        result = self._run([], exit_code=0)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        with open(os.path.join(self._root, "tsc-args.txt"), encoding="utf-8") as handle:
            args = handle.read().split()
        self.assertEqual(args[:2], ["-p", "tsconfig.test.json"])
        for flag in ("--noEmit", "--listFiles"):
            self.assertIn(flag, args)

    def test_ShouldFail_WhenFileOutsideBaselineHasAnError(self):
        self._baseline({})
        result = self._run([
            "tests/unit/b/three.test.tsx(5,7): error TS2345: Argument of type 'number' is "
            "not assignable to parameter of type 'string'.",
        ])
        self._assert_fails(result, "new type error", "tests/unit/b/three.test.tsx(5,7)",
                           "TS2345")

    def test_ShouldFail_WhenBaselinedFileGainsANewErrorCode(self):
        self._baseline({"src/a/one.test.ts": {"TS2532": 1}})
        result = self._run([
            "src/a/one.test.ts(3,1): error TS2532: Object is possibly 'undefined'.",
            "src/a/one.test.ts(4,1): error TS2339: Property 'x' does not exist on type 'Y'.",
        ])
        self._assert_fails(result, "src/a/one.test.ts(4,1)", "TS2339")
        self.assertNotIn("src/a/one.test.ts(3,1)", result.stdout)

    def test_ShouldFail_WhenBaselinedCountRises(self):
        self._baseline({"src/a/one.test.ts": {"TS2532": 1}})
        result = self._run([
            "src/a/one.test.ts(3,1): error TS2532: Object is possibly 'undefined'.",
            "src/a/one.test.ts(8,1): error TS2532: Object is possibly 'undefined'.",
        ])
        self._assert_fails(result, "new type error", "2 TS2532 (baseline 1)")

    def test_ShouldFail_WhenBaselineEntryNoLongerErrors(self):
        self._baseline({"src/a/one.test.ts": {"TS2532": 1}, "src/a/two.test.tsx": {"TS2345": 1}})
        result = self._run([
            "src/a/one.test.ts(3,1): error TS2532: Object is possibly 'undefined'.",
        ], exit_code=2)
        self._assert_fails(result, "stale", "src/a/two.test.tsx TS2345: baseline 1, now 0")

    def test_ShouldFail_WhenBaselinedCountDrops(self):
        self._baseline({"src/a/one.test.ts": {"TS2532": 3}})
        result = self._run([
            "src/a/one.test.ts(3,1): error TS2532: Object is possibly 'undefined'.",
        ])
        self._assert_fails(result, "stale", "src/a/one.test.ts TS2532: baseline 3, now 1")

    def test_ShouldNotCountContinuationLines_WhenADiagnosticSpansLines(self):
        self._baseline({"src/a/two.test.tsx": {"TS2322": 1}})
        result = self._run([
            "src/a/two.test.tsx(1,1): error TS2322: Type 'A' is not assignable to type 'B'.",
            "  Type 'undefined' is not assignable to type 'B'.",
            "    src/a/two.test.tsx(2,2): error TS2322: indented, part of the message above",
        ])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_ShouldFail_WhenACollectedTestFileIsNotTypeChecked(self):
        self._baseline({})
        result = self._run([], exit_code=0, listed=self._listed(_TEST_FILES[:2]))
        self._assert_fails(result, "not type-checked", "tests/unit/b/three.test.tsx")

    def test_ShouldIgnoreTestFiles_WhenUnderANonUnitTestDir(self):
        # tests/e2e/flow.spec.ts exists on disk but is Playwright, so it need not be listed.
        self._baseline({})
        result = self._run([], exit_code=0)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_ShouldFail_WhenFewerTestFilesThanTheLivenessFloor(self):
        self._baseline({}, min_files=50)
        result = self._run([], exit_code=0)
        self._assert_fails(result, "liveness", "3 test files")

    def test_ShouldFail_WhenTscReportsAGlobalError(self):
        self._baseline({})
        result = self._run(["error TS5083: Cannot read file 'tsconfig.test.json'."],
                           exit_code=1)
        self._assert_fails(result, "TS5083")

    def test_ShouldFail_WhenTscFailsWithoutDiagnostics(self):
        self._baseline({})
        result = self._run(["Segmentation fault"], exit_code=134)
        self._assert_fails(result, "exited 134")

    def test_ShouldFail_WhenTscIsMissing(self):
        self._baseline({})
        result = self._run([], tsc_env=False)
        self._assert_fails(result, "cannot run tsc")

    def test_ShouldFail_WhenBaselineIsMissing(self):
        result = self._run([])
        self._assert_fails(result, "cannot read baseline")

    def test_ShouldHaveTheSchema_WhenReadingTheCommittedBaseline(self):
        with open(os.path.join(_REPO, "unit-test-types-baseline.json"), encoding="utf-8") as handle:
            doc = json.load(handle)
        self.assertEqual(doc["tsconfig"], "tsconfig.test.json")
        self.assertGreater(doc["min_checked_test_files"], 0)
        for rel, codes in doc["errors"].items():
            self.assertTrue(os.path.isfile(os.path.join(_REPO, rel)), rel)
            for code, count in codes.items():
                self.assertRegex(code, r"^TS\d+$")
                self.assertIsInstance(count, int)
                self.assertGreater(count, 0, f"{rel} {code}")


if __name__ == "__main__":
    unittest.main()
