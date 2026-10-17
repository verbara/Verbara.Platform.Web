"""Unit tests for check-api-routes.py (console calls vs the OpenAPI document).

Builds tmp source trees + a tiny openapi.d.ts + baseline fixtures and runs the script
as a subprocess. Stdlib unittest only — NO pip deps (ADR-0013).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, os.pardir, "check-api-routes.py")

# The shape openapi-typescript emits: path keys at 2 spaces, methods at 4; a declared
# method is `get: {`, an undeclared one `get?: never;`.
_OPENAPI = """/** GENERATED FILE */
export interface paths {
  '/api/v{version}/admin/routes': {
    parameters: {
      query?: never;
    };
    get: {
      parameters: {
        query?: never;
      };
    };
    put?: never;
    post: {
      requestBody: {
        content: {
          'application/json': components['schemas']['X'];
        };
      };
    };
    delete?: never;
  };
  '/api/v{version}/admin/routes/reorder': {
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
      };
    };
  };
  '/api/v{version}/admin/routes/{id}': {
    get: {
      parameters: {
        path: {
          id: string;
        };
      };
    };
    put: {
      parameters: {
        path: {
          id: string;
        };
      };
    };
    post?: never;
  };
  '/api/v{version}/analytics/current-interval': {
    get: {
      parameters: {
        query?: never;
      };
    };
  };
}
export interface components {
  schemas: {
    X: {
      get: string;
    };
  };
}
"""


class CheckApiRoutesTests(unittest.TestCase):
    def setUp(self):
        self._root = tempfile.mkdtemp()
        os.makedirs(os.path.join(self._root, "src", "core", "api", "generated"))
        os.makedirs(os.path.join(self._root, "src", "core", "api", "hooks"))
        with open(os.path.join(self._root, "src", "core", "api", "generated", "openapi.d.ts"),
                  "w", encoding="utf-8") as handle:
            handle.write(_OPENAPI)
        self._baseline([])

    def tearDown(self):
        shutil.rmtree(self._root)

    def _src(self, rel, body):
        path = os.path.join(self._root, "src", rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(body)

    def _call(self, url, method, rel="core/api/hooks/use-x.ts"):
        self._src(rel, "import { customFetch } from '../client';\n"
                       "export const f = (id: string) =>\n"
                       f"  customFetch<void>({{ url: {url}, method: '{method}' }});\n")

    def _baseline(self, entries, min_calls=0):
        with open(os.path.join(self._root, "console-api-routes-baseline.json"),
                  "w", encoding="utf-8") as handle:
            json.dump({"min_scanned_calls": min_calls, "entries": entries}, handle)

    def _run(self):
        return subprocess.run([sys.executable, _SCRIPT, self._root],
                              capture_output=True, text=True)

    def _assert_pass(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("API routes OK.", result.stdout)

    def _assert_fail(self, result, needle):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(needle, result.stdout)

    def test_check_ShouldPass_WhenCallMatchesDeclaredPathAndMethod(self):
        self._call("'/api/v1/admin/routes'", "POST")
        self._assert_pass(self._run())

    def test_check_ShouldFail_WhenPathIsNotDeclared(self):
        self._call("'/api/v1/notification-rules'", "GET")
        self._assert_fail(self._run(), "no-path: GET /api/v1/notification-rules")

    def test_check_ShouldFail_WhenMethodIsNotDeclaredForPath(self):
        # The #413 shape: the route exists, but not with the method the console sends.
        self._call("'/api/v1/admin/routes/reorder'", "PUT")
        self._assert_fail(self._run(), "method-mismatch: PUT /api/v1/admin/routes/reorder")

    def test_check_ShouldFail_WhenMethodIsOnlyNeverTyped(self):
        self._call("'/api/v1/admin/routes'", "DELETE")
        self._assert_fail(self._run(), "method-mismatch: DELETE /api/v1/admin/routes")

    def test_check_ShouldFail_WhenLiteralSegmentOnlyMatchesAParam(self):
        # The #418 shape under a parameterised path: '/routes/abc-123' (or '/notifications/rules') is a literal
        # sub-resource, not the {id} parameter, so it must not pass just because PUT /routes/{id} exists.
        self._call("'/api/v1/admin/routes/abc-123'", "PUT")
        self._assert_fail(self._run(), "no-path: PUT /api/v1/admin/routes/abc-123")

    def test_check_ShouldCheckCustomFetchWithHeaders_WhenItCallsAnUndeclaredRoute(self):
        self._src("core/api/hooks/use-y.ts", "import { customFetchWithHeaders } from '../client';\n"
                  "export const g = () =>\n"
                  "  customFetchWithHeaders<void>({ url: '/api/v1/notification-rules', method: 'GET' });\n")
        self._assert_fail(self._run(), "no-path: GET /api/v1/notification-rules")

    def test_check_ShouldMatchParamSegment_WhenTemplateExpressionIsUsed(self):
        self._call("`/api/v1/admin/routes/${encodeURIComponent(id)}`", "GET")
        self._assert_pass(self._run())

    def test_check_ShouldNotMatchLiteralSegment_WhenTemplateExpressionIsUsed(self):
        # A placeholder is a parameter, never a literal route: POST /routes/${id} is not
        # POST /routes/reorder, so the {id} path's missing POST is a mismatch.
        self._call("`/api/v1/admin/routes/${id}`", "POST")
        self._assert_fail(self._run(), "method-mismatch: POST /api/v1/admin/routes/{*}")

    def test_check_ShouldIgnoreTrailingSlash_WhenUrlEndsWithSlash(self):
        self._call("'/api/v1/admin/routes/'", "GET")
        self._assert_pass(self._run())

    def test_check_ShouldDropQuerySuffix_WhenTemplateEndsGluedToSegment(self):
        self._call("`/api/v1/analytics/current-interval${params}`", "GET")
        self._assert_pass(self._run())

    def test_check_ShouldDropQueryString_WhenLiteralQueryFollows(self):
        self._call("`/api/v1/admin/routes?page=${page}&q=${q}`", "GET")
        self._assert_pass(self._run())

    def test_check_ShouldDropNestedTemplateQuery_WhenSuffixIsConditional(self):
        self._call("`/api/v1/admin/routes${qs ? `?${qs}` : ''}`", "GET")
        self._assert_pass(self._run())

    def test_check_ShouldCheckRawFetch_WhenUrlIsLiteralApiPath(self):
        self._src("core/auth/page.tsx",
                  "await fetch('/api/v1/admin/routes/reorder', { method: 'PUT', body });\n")
        self._assert_fail(self._run(), "method-mismatch: PUT /api/v1/admin/routes/reorder")

    def test_check_ShouldTreatRawFetchAsGet_WhenNoMethodIsGiven(self):
        self._src("core/auth/page.tsx", "await fetch('/api/v1/admin/routes/reorder');\n")
        self._assert_fail(self._run(), "method-mismatch: GET /api/v1/admin/routes/reorder")

    def test_check_ShouldIgnoreCommentsAndStrings_WhenTheyMentionACall(self):
        self._src("core/api/hooks/doc.ts",
                  "// customFetch({ url: '/api/v1/nope', method: 'GET' })\n"
                  "/* fetch('/api/v1/nope') */\n"
                  "const s = \"customFetch({ url: '/api/v1/nope', method: 'GET' })\";\n")
        self._assert_pass(self._run())

    def test_check_ShouldSkipTestAndGeneratedFiles_WhenTheyHoldUndeclaredCalls(self):
        self._call("'/api/v1/nope'", "GET", rel="core/api/hooks/use-x.test.ts")
        self._call("'/api/v1/nope'", "GET", rel="core/api/generated/client.ts")
        self._assert_pass(self._run())

    def test_check_ShouldPass_WhenViolationIsBaselined(self):
        self._call("`/api/v1/analytics/cdr/${id}/transcript`", "GET")
        self._baseline([{"method": "GET", "path": "/api/v1/analytics/cdr/{*}/transcript",
                         "file": "src/core/api/hooks/use-x.ts", "kind": "no-path"}])
        self._assert_pass(self._run())

    def test_check_ShouldFail_WhenBaselinedViolationMovesToAnotherFile(self):
        self._call("'/api/v1/nope'", "GET", rel="core/api/hooks/use-y.ts")
        self._baseline([{"method": "GET", "path": "/api/v1/nope",
                         "file": "src/core/api/hooks/use-x.ts", "kind": "no-path"}])
        result = self._run()
        self._assert_fail(result, "no-path: GET /api/v1/nope")
        self.assertIn("no longer occur", result.stdout)

    def test_check_ShouldFailAsStale_WhenBaselineEntryNoLongerOccurs(self):
        self._call("'/api/v1/admin/routes'", "GET")
        self._baseline([{"method": "GET", "path": "/api/v1/nope",
                         "file": "src/core/api/hooks/use-x.ts", "kind": "no-path"}])
        self._assert_fail(self._run(), "no longer occur")

    def test_check_ShouldFail_WhenFewerCallsThanLivenessFloor(self):
        self._call("'/api/v1/admin/routes'", "GET")
        self._baseline([], min_calls=2)
        self._assert_fail(self._run(), "below min_scanned_calls=2")

    def test_check_ShouldNotCheck_WhenUrlIsNotALiteral(self):
        self._src("core/api/hooks/use-z.ts",
                  "customFetch({ url: flag ? '/api/v1/a' : '/api/v1/b', method: 'GET' });\n"
                  "customFetch({ url: '/api/v1/admin/routes', method: 'GET' as const });\n")
        result = self._run()
        self._assert_pass(result)
        self.assertIn("1 call(s) checked", result.stdout)
        self.assertIn("1 unresolved", result.stdout)


if __name__ == "__main__":
    unittest.main()
