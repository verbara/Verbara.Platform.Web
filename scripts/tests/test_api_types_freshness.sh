#!/usr/bin/env bash
# test_api_types_freshness.sh — unit tests for scripts/ci/api-types-freshness.sh, the steps of the
# api-types-freshness workflow (change generated-types-follow-platform-main, design D6).
# `gh` is stubbed on PATH (Platform's artifacts and this repo's issues), and so are `node` (the
# generator: it writes a fixture to --out) and `npx` (prettier: a no-op, the fixtures are already
# formatted); the resolver, the checker and the issue sync are the real scripts. The point of the
# unavailable cases: on a PR a missing source is a warning that passes, the summary says the copy
# was NOT checked, and nothing is regenerated or compared. Bash + jq + python3, no network.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIVER="$SCRIPT_DIR/../ci/api-types-freshness.sh"

fails=0
pass=0
fail() { echo "FAIL: $CASE — $*"; fails=$((fails + 1)); }

HEAD_SHA=1111111111111111111111111111111111111111
PARENT_SHA=2222222222222222222222222222222222222222
OTHER_SHA=3333333333333333333333333333333333333333

FIXTURE='/** GENERATED FILE */
export interface paths {
  '"'"'/api/v{version}/x'"'"': {
    get?: never;
    post: {
      responses: {
        200: {
          content?: never;
        };
      };
    };
  };
}
export interface components {
  schemas: {
    A: {
      id: string;
    };
  };
  responses: never;
}
'

new_case() {
  CASE="$1"
  STUB_DIR="$(mktemp -d)"
  mkdir -p "$STUB_DIR/bin" "$STUB_DIR/runner"
  printf '%s' "$FIXTURE" > "$STUB_DIR/committed.d.ts"
  printf '%s' "$FIXTURE" > "$STUB_DIR/regenerated.d.ts"
  printf '{"sha":"%s","parents":[{"sha":"%s"}]}\n' "$HEAD_SHA" "$PARENT_SHA" > "$STUB_DIR/commit_main.json"
  printf '{"sha":"%s","parents":[{"sha":"%s"}]}\n' "$HEAD_SHA" "$PARENT_SHA" > "$STUB_DIR/commit_$HEAD_SHA.json"
  echo '[]' > "$STUB_DIR/issues.json"
  echo '[{"name":"api-types-drift"}]' > "$STUB_DIR/labels.json"
  : > "$STUB_DIR/calls.log"
  : > "$STUB_DIR/summary.md"
  cat > "$STUB_DIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "$STUB_DIR/calls.log"
case "$1 $2" in
  "api repos/"*)
    ep="$2"
    case "$ep" in
      */actions/artifacts\?name=openapi-document-*)
        f="$STUB_DIR/artifacts_${ep##*name=openapi-document-}.json"
        [ -f "$f" ] && cat "$f" || echo '{"total_count":0,"artifacts":[]}'
        exit 0 ;;
      */commits/*) f="$STUB_DIR/commit_${ep##*/commits/}.json" ;;
      */compare/*) r="${ep##*/compare/}"; f="$STUB_DIR/compare_${r%%...*}_${r##*...}.json" ;;
    esac
    [ -f "$f" ] && { cat "$f"; exit 0; }
    echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;
  "run download")
    [ -f "$STUB_DIR/download_refused" ] && { echo "HTTP 403: Resource not accessible by integration" >&2; exit 1; }
    while [ $# -gt 0 ]; do [ "$1" = -D ] && dir="$2"; shift; done
    mkdir -p "$dir"; echo '{"openapi":"3.1.0"}' > "$dir/openapi-document.json" ;;
  "issue list") cat "$STUB_DIR/issues.json" ;;
  "label list") cat "$STUB_DIR/labels.json" ;;
  "issue create")
    while [ $# -gt 0 ]; do [ "$1" = --body-file ] && cp "$2" "$STUB_DIR/issue-body.md"; shift; done
    echo https://github.com/o/r/issues/9 ;;
  "issue edit"|"issue close"|"label create") : ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 99 ;;
esac
STUB
  cat > "$STUB_DIR/bin/node" <<'STUB'
#!/usr/bin/env bash
printf 'node %s\n' "$*" >> "$STUB_DIR/calls.log"
while [ $# -gt 0 ]; do [ "$1" = --out ] && cp "$STUB_DIR/regenerated.d.ts" "$2"; shift; done
STUB
  cat > "$STUB_DIR/bin/npx" <<'STUB'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >> "$STUB_DIR/calls.log"
STUB
  chmod +x "$STUB_DIR/bin/"*
}

artifact_for() { # artifact_for <sha>
  printf '{"total_count":1,"artifacts":[{"id":7,"name":"openapi-document-%s","expired":false,"workflow_run":{"id":4242}}]}\n' "$1" > "$STUB_DIR/artifacts_$1.json"
}

run_driver() {
  set +e
  OUT="$(PATH="$STUB_DIR/bin:$PATH" STUB_DIR="$STUB_DIR" GITHUB_STEP_SUMMARY="$STUB_DIR/summary.md" \
    RUNNER_TEMP="$STUB_DIR/runner" COMMITTED_TYPES="$STUB_DIR/committed.d.ts" GITHUB_RUN_ID=55 \
    GITHUB_REPOSITORY=o/r bash "$DRIVER" "$@" 2>&1)"
  RC=$?
  set -e
  SUMMARY="$(cat "$STUB_DIR/summary.md")"
}

expect_rc() { [ "$RC" = "$1" ] || fail "expected exit $1, got $RC (output: $OUT)"; }
expect_out() { printf '%s\n' "$OUT" | grep -qF -- "$1" || fail "output lacks '$1' (output: $OUT)"; }
expect_summary() { printf '%s\n' "$SUMMARY" | grep -qF -- "$1" || fail "summary lacks '$1' (summary: $SUMMARY)"; }
expect_no_summary() { ! printf '%s\n' "$SUMMARY" | grep -qiF -- "$1" || fail "summary must not contain '$1' (summary: $SUMMARY)"; }
expect_calls() {
  local n
  n="$(grep -cF -- "$1" "$STUB_DIR/calls.log" || true)"
  [ "$n" = "$2" ] || fail "expected $2 call(s) matching '$1', got $n"
}
finish_case() {
  [ -z "$(ls -A "$STUB_DIR/runner")" ] || fail "the temp work dir was left behind"
  [ "$fails" = "$1" ] && pass=$((pass + 1))
  rm -rf "$STUB_DIR"
}

# --- PR, download refused: warning, job passes, never "fresh", nothing compared ---
new_case "PR, download refused"; f0=$fails
artifact_for "$HEAD_SHA"; touch "$STUB_DIR/download_refused"
run_driver --mode pr
expect_rc 0
expect_out "::warning title=API types not checked::source unavailable for Platform commit $HEAD_SHA: download refused for openapi-document-$HEAD_SHA"
expect_summary "source unavailable"
expect_summary "**not checked**"
expect_summary "download refused"
expect_no_summary "fresh"
expect_calls "node " 0
expect_calls "npx " 0
expect_calls "gh issue" 0
finish_case "$f0"

# --- PR, no artifact and a non-Markdown change in between: same, another reason ---
new_case "PR, non-Markdown range"; f0=$fails
artifact_for "$PARENT_SHA"
printf '{"status":"ahead","files":[{"filename":"src/Api/Program.cs"}]}\n' > "$STUB_DIR/compare_${PARENT_SHA}_${HEAD_SHA}.json"
run_driver --mode pr
expect_rc 0
expect_out "::warning title=API types not checked::"
expect_summary "non-Markdown change between $PARENT_SHA and $HEAD_SHA: src/Api/Program.cs"
expect_no_summary "fresh"
expect_calls "node " 0
expect_calls "gh run download" 0
finish_case "$f0"

# --- PR, fresh ---
new_case "PR, fresh"; f0=$fails
artifact_for "$HEAD_SHA"
run_driver --mode pr
expect_rc 0
expect_out "fresh"
expect_summary "## Generated API types: fresh"
expect_summary "$HEAD_SHA"
expect_calls "node " 1
expect_calls "npx --no-install prettier --config" 1
finish_case "$f0"

# --- PR, fresh against a document reused for a Markdown-only head: names both commits ---
new_case "PR, fresh via a Markdown-only head"; f0=$fails
artifact_for "$PARENT_SHA"
printf '{"status":"ahead","files":[{"filename":"CHANGELOG.md"}]}\n' > "$STUB_DIR/compare_${PARENT_SHA}_${HEAD_SHA}.json"
run_driver --mode pr
expect_rc 0
expect_summary "$PARENT_SHA (document reused for the Markdown-only head $HEAD_SHA)"
finish_case "$f0"

# --- PR, stale: red, names the route, the commit and the fix command ---
new_case "PR, stale"; f0=$fails
artifact_for "$HEAD_SHA"
printf '%s' "$FIXTURE" | sed 's/        200: {/        204: {/' > "$STUB_DIR/regenerated.d.ts"
run_driver --mode pr
expect_rc 1
expect_out "::error title=API types are stale::"
expect_summary "changed route: POST /api/v{version}/x"
expect_summary "Platform commit: \`$HEAD_SHA\`"
expect_summary "gh run download -R verbara/Verbara.Platform -n openapi-document-$HEAD_SHA"
expect_summary "npm run generate:api-types"
expect_calls "gh issue" 0
finish_case "$f0"

# --- --platform-sha starts from the given commit ---
new_case "dispatch with platform-sha"; f0=$fails
artifact_for "$OTHER_SHA"
run_driver --mode pr --platform-sha "$OTHER_SHA"
expect_rc 0
expect_calls "commits/main" 0
expect_calls "artifacts?name=openapi-document-$OTHER_SHA" 1
expect_summary "$OTHER_SHA"
finish_case "$f0"

# --- issue mode, stale: opens the drift issue with the report ---
new_case "issue mode, stale"; f0=$fails
artifact_for "$HEAD_SHA"
printf '%s' "$FIXTURE" | sed 's/        200: {/        204: {/' > "$STUB_DIR/regenerated.d.ts"
run_driver --mode issue
expect_rc 0
expect_calls "gh issue create" 1
grep -qF "changed route: POST /api/v{version}/x" "$STUB_DIR/issue-body.md" || fail "issue body lacks the route"
grep -qF "https://github.com/o/r/actions/runs/55" "$STUB_DIR/issue-body.md" || fail "issue body lacks the run URL"
finish_case "$f0"

# --- issue mode, unavailable: opens the issue with the section, never compares ---
new_case "issue mode, unavailable"; f0=$fails
run_driver --mode issue
expect_rc 0
expect_calls "gh issue create" 1
expect_calls "node " 0
grep -qF "## Source unavailable" "$STUB_DIR/issue-body.md" || fail "issue body lacks the unavailable section"
finish_case "$f0"

# --- issue mode, fresh with an open issue: closes it ---
new_case "issue mode, fresh"; f0=$fails
artifact_for "$HEAD_SHA"
echo '[{"number":5,"createdAt":"2026-11-20T00:00:00Z"}]' > "$STUB_DIR/issues.json"
run_driver --mode issue
expect_rc 0
expect_calls "gh issue close 5 --comment" 1
grep -F "gh issue close 5" "$STUB_DIR/calls.log" | grep -qF "$HEAD_SHA" || fail "close comment lacks the commit"
finish_case "$f0"

# --- usage ---
new_case "no mode"; f0=$fails
run_driver
expect_rc 2
finish_case "$f0"

echo "api-types-freshness: $pass passed, $fails failed"
[ "$fails" -eq 0 ]
