"""Unit tests for check-api-types-fresh.py (committed openapi.d.ts vs Platform's document).

Writes two prettier-formatted declaration files to a temp dir and runs the script as a
subprocess. Stdlib unittest only — NO pip deps (ADR-0013). The fixtures use the shape
`npm run generate:api-types` commits: path keys at 2 spaces and their methods at 4,
`components.schemas` members at 4, leading JSDoc at the indent of the member it documents.
"""
import os
import subprocess
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, os.pardir, "check-api-types-fresh.py")

_WHISPER = "/api/v{version}/supervisor/sessions/{sessionId}/whisper"

_BASE = """/**
 * GENERATED FILE — do not hand-edit.
 */
export interface paths {
  '/api/v{version}/agents': {
    parameters: {
      query?: never;
    };
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            'application/json': components['schemas']['AgentDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
  };
  '/api/v{version}/supervisor/sessions/{sessionId}/whisper': {
    parameters: {
      query?: never;
    };
    get?: never;
    /**
     * Sends a supervisor's text whisper to the session's agent
     */
    post: {
      responses: {
        /** @description OK */
        200: {
          content?: never;
        };
      };
    };
    delete?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    AgentDto: {
      userId: string;
      state: components['schemas']['AgentState'];
    };
    /** @enum {unknown} */
    AgentState: 'Offline' | 'Available' | 'Busy';
    ChannelType:
      | 'Voice'
      | 'WhatsApp'
      | 'Sms';
    HttpValidationProblemDetails: {
      type?: null | string;
      title?: null | string;
    };
    /**
     * @description Audit-log entry payload posted from Realtime to the Api.
     *     Fire-and-forget.
     */
    HubAuditEntry: {
      action: string;
    };
    QueueDto: {
      id: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
"""


def _replace(text, old, new):
    if old not in text:
        raise AssertionError(f"fixture edit did not apply: {old!r}")
    return text.replace(old, new, 1)


class CheckApiTypesFreshTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def _run(self, committed, regenerated):
        a = os.path.join(self._tmp.name, "committed.d.ts")
        b = os.path.join(self._tmp.name, "regenerated.d.ts")
        with open(a, "w", encoding="utf-8") as f:
            f.write(committed)
        with open(b, "w", encoding="utf-8") as f:
            f.write(regenerated)
        proc = subprocess.run(
            [sys.executable, _SCRIPT, a, b], capture_output=True, text=True, check=False
        )
        return proc.returncode, proc.stdout, proc.stderr

    def _reported(self, out):
        """The reported keys, one per `added|removed|changed …: <key>` line."""
        return [line for line in out.splitlines() if line.startswith(("added ", "removed ", "changed "))]

    def test_main_ShouldPrintFresh_WhenFilesAreEqual(self):
        code, out, err = self._run(_BASE, _BASE)
        self.assertEqual(code, 0, out + err)
        self.assertEqual(out.strip(), "fresh")

    def test_main_ShouldNameTheRoute_WhenOnePathBlockChanged(self):
        stale = _replace(_BASE, "        /** @description OK */\n        200: {\n          content?: never;",
                         "        /** @description No Content */\n        204: {\n          content?: never;")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), [f"changed route: POST {_WHISPER}"])

    def test_main_ShouldNameTheMethod_WhenOnlyItsLeadingJsDocChanged(self):
        stale = _replace(_BASE, "     * Sends a supervisor's text whisper to the session's agent",
                         "     * Sends a supervisor's text whisper to the bound agent")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), [f"changed route: POST {_WHISPER}"])

    def test_main_ShouldNameAddedAndRemovedRoutes_WhenAPathIsAddedOrRemoved(self):
        block = "  '/api/v{version}/agents': {\n"
        start = _BASE.index(block)
        end = _BASE.index("  '/api/v{version}/supervisor")
        without_agents = _BASE[:start] + _BASE[end:]
        code, out, err = self._run(_BASE, without_agents)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), ["removed route: /api/v{version}/agents"])
        code, out, err = self._run(without_agents, _BASE)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), ["added route: /api/v{version}/agents"])

    def test_main_ShouldNameBoth_WhenOneSchemaIsAddedAndAnotherRemoved(self):
        stale = _replace(_BASE, "    QueueDto: {\n      id: string;\n    };\n",
                         "    TeamDto: {\n      name: string;\n    };\n")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(sorted(self._reported(out)),
                         ["added schema: TeamDto", "removed schema: QueueDto"])

    def test_main_ShouldNameEachNonObjectSchemaByItsOwnKey_WhenChangedAddedAndRemoved(self):
        stale = _replace(_BASE, "'Offline' | 'Available' | 'Busy';",
                         "'Offline' | 'Available' | 'Busy' | 'Break';")
        stale = _replace(stale, "    ChannelType:\n      | 'Voice'\n      | 'WhatsApp'\n      | 'Sms';\n",
                         "    EntityId: unknown;\n")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(sorted(self._reported(out)), [
            "added schema: EntityId",
            "changed schema: AgentState",
            "removed schema: ChannelType",
        ])

    def test_main_ShouldNameTheDocumentedSchema_WhenOnlyItsLeadingJsDocChanged(self):
        stale = _replace(_BASE, "     *     Fire-and-forget.", "     *     Fire-and-forget; no ack.")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), ["changed schema: HubAuditEntry"])

    def test_main_ShouldNotFlagThePrecedingSchema_WhenADocumentedSchemaIsRemoved(self):
        stale = _replace(_BASE, "    /** @enum {unknown} */\n    AgentState: 'Offline' | 'Available' | 'Busy';\n", "")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), ["removed schema: AgentState"])

    def test_main_ShouldNotBlameTheLastSchema_WhenOnlyTheComponentsTailChanged(self):
        stale = _replace(_BASE, "  requestBodies: never;\n", "  requestBodies: unknown;\n")
        code, out, err = self._run(_BASE, stale)
        self.assertEqual(code, 1, out + err)
        self.assertEqual(self._reported(out), ["changed file remainder"])

    def test_main_ShouldExitTwo_WhenAFileHasNoPathsBlock(self):
        no_paths = _BASE[: _BASE.index("export interface paths")] + _BASE[_BASE.index("export type webhooks"):]
        code, out, err = self._run(_BASE, no_paths)
        self.assertEqual(code, 2, out + err)
        self.assertNotIn("fresh", out)
        code, out, err = self._run(no_paths, no_paths)
        self.assertEqual(code, 2, out + err)
        self.assertNotIn("fresh", out)

    def test_main_ShouldExitTwo_WhenAFileIsEmpty(self):
        code, out, err = self._run("", "")
        self.assertEqual(code, 2, out + err)
        self.assertNotIn("fresh", out)
        code, out, err = self._run(_BASE, "")
        self.assertEqual(code, 2, out + err)

    def test_main_ShouldExitTwo_WhenAnArgumentIsMissing(self):
        proc = subprocess.run([sys.executable, _SCRIPT], capture_output=True, text=True, check=False)
        self.assertEqual(proc.returncode, 2)


if __name__ == "__main__":
    unittest.main()
