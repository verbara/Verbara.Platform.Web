"""Wiring tests for release.yml's tag-on-main guard.

test_check_tag_on_main.sh proves the script refuses a tag off `main`; this file proves
release.yml still runs it where it counts. The guard only works if:

  * a `tag-on-main` job runs `bash scripts/ci/check-tag-on-main.sh "$GITHUB_SHA" origin/main`
    as the whole of a step, with no `if:` or `continue-on-error` on the job or that step;
  * every other job `needs: tag-on-main` and has no job-level `if:` with a status function
    (`always()`, `cancelled()`, `failure()`), which would run it after the guard failed.

Dropping `needs:`, prefixing the command with `true ||` or appending `|| true` turns this red.

Stdlib unittest only (CI's Python has no YAML module), so release.yml is read by the small
line parser below. It knows only the block style release.yml uses; anything it cannot place
leaves a job or step without the keys the tests look for, so a reshaped file fails here
instead of passing.
"""
import os
import re
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_RELEASE_YML = os.path.abspath(
    os.path.join(_HERE, os.pardir, os.pardir, ".github", "workflows", "release.yml"),
)
_GUARD_JOB = "tag-on-main"
_GUARD_COMMAND = 'bash scripts/ci/check-tag-on-main.sh "$GITHUB_SHA" origin/main'
_STATUS_FUNCTIONS = re.compile(r"\b(always|cancelled|failure)\s*\(")

_KEY = re.compile(r"^(?P<key>[A-Za-z0-9_-]+):(?:\s+(?P<value>.*))?$")


def _strip_comment(value):
    # Drops a trailing ` # comment` from an unquoted scalar; release.yml's values hold no `#`.
    if value.startswith(("'", '"')):
        return value
    return re.sub(r"\s+#.*$", "", value)


def _unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        return value[1:-1]
    return value


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def _mapping(lines, indent):
    """Read the keys at exactly `indent` columns from `lines`.

    Returns {key: value}. A scalar value is a string; a key whose value is on the following,
    deeper lines gets those raw lines (a block scalar, a nested map or a block list).
    """
    result = {}
    key = None
    for line in lines:
        if _indent(line) == indent:
            match = _KEY.match(line[indent:])
            if match is None:
                key = None
                continue
            key = match.group("key")
            value = _strip_comment(match.group("value") or "").strip()
            result[key] = value if value and value not in ("|", ">", "|-", ">-") else []
        elif _indent(line) > indent and key is not None and isinstance(result[key], list):
            result[key].append(line)
    return result


def _significant(lines):
    return [
        line.rstrip("\n") for line in lines
        if line.strip() and not line.lstrip().startswith("#")
    ]


def parse_jobs(text):
    """{job_id: {"keys": {...}, "needs": [...], "steps": [{...}, ...]}} from release.yml."""
    lines = text.splitlines()
    try:
        start = lines.index("jobs:")
    except ValueError:
        return {}
    body = []
    for line in lines[start + 1:]:
        if line.strip() and _indent(line) == 0:
            break
        body.append(line)
    jobs = {}
    for job_id, job_lines in _mapping(_significant(body), 2).items():
        if not isinstance(job_lines, list):
            continue
        keys = _mapping(job_lines, 4)
        jobs[job_id] = {
            "keys": keys,
            "needs": _needs(keys.get("needs")),
            "steps": _steps(keys.get("steps")),
        }
    return jobs


def _needs(value):
    if value is None:
        return []
    if isinstance(value, str):
        if value.startswith("[") and value.endswith("]"):
            return [_unquote(item.strip()) for item in value[1:-1].split(",") if item.strip()]
        return [_unquote(value)]
    return [
        _unquote(_strip_comment(line.strip()[2:].strip()))
        for line in value if line.strip().startswith("- ")
    ]


def _steps(value):
    if not isinstance(value, list):
        return []
    steps = []
    current = None
    for line in value:
        if _indent(line) == 6 and line[6:].startswith("- "):
            current = [" " * 8 + line[8:]]
            steps.append(current)
        elif current is not None:
            current.append(line)
    parsed = []
    for step_lines in steps:
        step = _mapping(step_lines, 8)
        run = step.get("run")
        if isinstance(run, list):
            step["run"] = "\n".join(line.strip() for line in run)
        elif isinstance(run, str):
            step["run"] = _unquote(run)
        parsed.append(step)
    return parsed


class ReleaseTagOnMainWiringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(_RELEASE_YML, encoding="utf-8") as handle:
            cls.jobs = parse_jobs(handle.read())

    def test_parser_ShouldFindTheGuardAndAtLeastOneOtherJob_WhenReadingReleaseYml(self):
        self.assertIn(_GUARD_JOB, self.jobs)
        self.assertGreater(len(self.jobs), 1, msg=f"jobs parsed: {sorted(self.jobs)}")
        for job_id, job in self.jobs.items():
            self.assertTrue(job["steps"], msg=f"no steps parsed for job {job_id!r}")

    def test_guardJob_ShouldRunTheCheckAsAWholeStep_WhenNothingCanSkipIt(self):
        guard = self.jobs[_GUARD_JOB]
        self.assertNotIn("if", guard["keys"], msg="the guard job must not be conditional")
        self.assertNotIn("continue-on-error", guard["keys"])
        checks = [step for step in guard["steps"] if step.get("run") == _GUARD_COMMAND]
        self.assertEqual(
            len(checks), 1,
            msg=f"expected one step whose whole run is {_GUARD_COMMAND!r}; runs: "
                f"{[step.get('run') for step in guard['steps']]}",
        )
        self.assertNotIn("if", checks[0], msg="the check step must not be conditional")
        self.assertNotIn("continue-on-error", checks[0])

    def test_everyOtherJob_ShouldNeedTheGuard_WhenItCouldBuildOrSign(self):
        others = {job_id: job for job_id, job in self.jobs.items() if job_id != _GUARD_JOB}
        self.assertIn("release", others)
        for job_id, job in others.items():
            self.assertIn(
                _GUARD_JOB, job["needs"],
                msg=f"job {job_id!r} does not need {_GUARD_JOB!r} (needs: {job['needs']})",
            )
            condition = job["keys"].get("if")
            if condition is not None:
                self.assertIsNone(
                    _STATUS_FUNCTIONS.search(str(condition)),
                    msg=f"job {job_id!r} could run after the guard failed: if: {condition}",
                )


class ParserTests(unittest.TestCase):
    def test_needs_ShouldReadEveryForm_WhenScalarFlowOrBlockList(self):
        text = "\n".join([
            "jobs:",
            "  a:",
            "    steps:",
            "      - run: echo a",
            "  b:",
            "    needs: a",
            "    steps:",
            "      - run: echo b",
            "  c:",
            "    needs: [a, 'b']",
            "    steps:",
            "      - run: echo c",
            "  d:",
            "    needs:",
            "      - a",
            "      - c # comment",
            "    if: ${{ always() }}",
            "    steps:",
            "      - name: multi",
            "        run: |",
            "          true ||",
            "          echo d",
            "",
        ])
        jobs = parse_jobs(text)
        self.assertEqual(jobs["a"]["needs"], [])
        self.assertEqual(jobs["b"]["needs"], ["a"])
        self.assertEqual(jobs["c"]["needs"], ["a", "b"])
        self.assertEqual(jobs["d"]["needs"], ["a", "c"])
        self.assertEqual(jobs["d"]["keys"]["if"], "${{ always() }}")
        self.assertEqual(jobs["d"]["steps"][0]["run"], "true ||\necho d")
        self.assertEqual(jobs["d"]["steps"][0]["name"], "multi")


if __name__ == "__main__":
    unittest.main()
