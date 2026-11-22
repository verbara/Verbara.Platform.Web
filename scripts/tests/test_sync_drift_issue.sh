#!/usr/bin/env bash
# test_sync_drift_issue.sh — unit tests for scripts/ci/sync-drift-issue.sh (change
# generated-types-follow-platform-main, design D6). `gh` is replaced by a stub on PATH that
# serves the open-issue and label lists from fixtures and logs every call (with the body it
# was given), so create, update, close and the duplicate case are proved without a live
# repository. Pure bash + jq, no network.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC="$SCRIPT_DIR/../ci/sync-drift-issue.sh"

fails=0
pass=0
fail() { echo "FAIL: $CASE — $*"; fails=$((fails + 1)); }

new_case() {
  CASE="$1"
  STUB_DIR="$(mktemp -d)"
  mkdir -p "$STUB_DIR/bin"
  echo '[]' > "$STUB_DIR/issues.json"
  echo '[{"name":"bug"},{"name":"api-types-drift"}]' > "$STUB_DIR/labels.json"
  cat > "$STUB_DIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/calls.log"
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  if [ "${args[$i]}" = --body-file ]; then
    n=$(wc -l < "$STUB_DIR/calls.log")
    cp "${args[$((i + 1))]}" "$STUB_DIR/body.$n"
    cp "${args[$((i + 1))]}" "$STUB_DIR/body.last"
  fi
done
case "$1 $2" in
  "issue list") cat "$STUB_DIR/issues.json" ;;
  "label list") cat "$STUB_DIR/labels.json" ;;
  "issue create") echo "https://github.com/o/r/issues/77" ;;
  "issue edit"|"issue close"|"label create") : ;;
  *) echo "stub gh: unexpected call: $*" >&2; exit 99 ;;
esac
STUB
  chmod +x "$STUB_DIR/bin/gh"
  : > "$STUB_DIR/calls.log"
  printf 'stale: 1 declaration(s) differ\nchanged route: POST /api/v{version}/x\n' > "$STUB_DIR/report.txt"
}

open_issues() { # open_issues <number:createdAt>...
  local items=() a
  for a in "$@"; do items+=("{\"number\":${a%%:*},\"createdAt\":\"${a#*:}\"}"); done
  local IFS=,
  echo "[${items[*]}]" > "$STUB_DIR/issues.json"
}

run_sync() {
  set +e
  OUT="$(PATH="$STUB_DIR/bin:$PATH" STUB_DIR="$STUB_DIR" bash "$SYNC" "$@" 2> "$STUB_DIR/stderr")"
  RC=$?
  set -e
  ERR="$(cat "$STUB_DIR/stderr")"
}

expect_rc() { [ "$RC" = "$1" ] || fail "expected exit $1, got $RC (stdout: $OUT; stderr: $ERR)"; }
expect_calls() { # expect_calls <fixed-string> <count>
  local n
  n="$(grep -cF -- "$1" "$STUB_DIR/calls.log" || true)"
  [ "$n" = "$2" ] || fail "expected $2 call(s) matching '$1', got $n ($(tr '\n' '|' < "$STUB_DIR/calls.log"))"
}
expect_body() { grep -qF -- "$1" "$STUB_DIR/body.last" 2> /dev/null || fail "issue body lacks '$1'"; }
expect_no_body() { ! grep -qF -- "$1" "$STUB_DIR/body.last" 2> /dev/null || fail "issue body should not contain '$1'"; }
finish_case() { [ "$fails" = "$1" ] && pass=$((pass + 1)); rm -rf "$STUB_DIR"; }

RUN=https://github.com/o/r/actions/runs/1

# --- stale, no open issue, label missing: creates the label and one issue ---
new_case "stale, no open issue"; f0=$fails
echo '[{"name":"bug"}]' > "$STUB_DIR/labels.json"
run_sync --state stale --commit aaaa111 --report "$STUB_DIR/report.txt" --run-url "$RUN"
expect_rc 0
expect_calls "issue list --label api-types-drift --state open" 1
expect_calls "label create api-types-drift" 1
expect_calls "issue create" 1
expect_calls "--label api-types-drift" 2
expect_calls "issue edit" 0
expect_body "Platform commit: aaaa111"
expect_body "changed route: POST /api/v{version}/x"
expect_body "npm run generate:api-types"
expect_body "$RUN"
finish_case "$f0"

# --- stale, label exists: no label create ---
new_case "stale, label already exists"; f0=$fails
run_sync --state stale --commit aaaa111 --report "$STUB_DIR/report.txt"
expect_rc 0
expect_calls "label create" 0
expect_calls "issue create" 1
finish_case "$f0"

# --- stale again with a newer commit: edits the same issue, no second one ---
new_case "stale again, newer commit"; f0=$fails
open_issues "12:2026-11-20T06:30:00Z"
run_sync --state stale --commit bbbb222 --report "$STUB_DIR/report.txt"
expect_rc 0
expect_calls "issue edit 12 --body-file" 1
expect_calls "issue create" 0
expect_body "Platform commit: bbbb222"
expect_no_body "aaaa111"
finish_case "$f0"

# --- fresh with an open issue: closes it, naming the commit ---
new_case "fresh, open issue"; f0=$fails
open_issues "12:2026-11-20T06:30:00Z"
run_sync --state fresh --commit cccc333
expect_rc 0
expect_calls "issue close 12 --comment" 1
grep -F "issue close 12" "$STUB_DIR/calls.log" | grep -qF cccc333 || fail "close comment does not name cccc333"
expect_calls "issue create" 0
expect_calls "issue edit" 0
finish_case "$f0"

# --- fresh with no open issue: nothing to do ---
new_case "fresh, no open issue"; f0=$fails
run_sync --state fresh --commit cccc333
expect_rc 0
expect_calls "issue close" 0
expect_calls "issue create" 0
finish_case "$f0"

# --- source unavailable, no open issue: opens one with the section ---
new_case "source unavailable, no open issue"; f0=$fails
printf 'no openapi-document artifact on dddd444 or its 30 first-parent ancestors\n' > "$STUB_DIR/reason.txt"
run_sync --state unavailable --commit dddd444 --report "$STUB_DIR/reason.txt"
expect_rc 0
expect_calls "issue create" 1
expect_body "## Source unavailable"
expect_body "not checked"
expect_body "no openapi-document artifact on dddd444"
expect_no_body "## Stale copy"
finish_case "$f0"

# --- source unavailable, open issue: updates it with the section ---
new_case "source unavailable, open issue"; f0=$fails
open_issues "12:2026-11-20T06:30:00Z"
printf 'download refused\n' > "$STUB_DIR/reason.txt"
run_sync --state unavailable --commit dddd444 --report "$STUB_DIR/reason.txt"
expect_rc 0
expect_calls "issue edit 12 --body-file" 1
expect_calls "issue create" 0
expect_body "## Source unavailable"
finish_case "$f0"

# --- two open issues: updates the oldest and fails loudly ---
new_case "two open issues"; f0=$fails
open_issues "30:2026-11-21T06:30:00Z" "12:2026-11-20T06:30:00Z"
run_sync --state stale --commit eeee555 --report "$STUB_DIR/report.txt"
expect_rc 4
expect_calls "issue edit 12 --body-file" 1
expect_calls "issue edit 30" 0
expect_calls "issue create" 0
printf '%s\n' "$ERR" | grep -qF "2 open issues" || fail "stderr does not name the duplicate count ($ERR)"
finish_case "$f0"

# --- two open issues, fresh: closes the oldest and still fails loudly ---
new_case "two open issues, fresh"; f0=$fails
open_issues "30:2026-11-21T06:30:00Z" "12:2026-11-20T06:30:00Z"
run_sync --state fresh --commit ffff666
expect_rc 4
expect_calls "issue close 12" 1
expect_calls "issue close 30" 0
finish_case "$f0"

# --- usage ---
new_case "unknown state"; f0=$fails
run_sync --state maybe --commit x
expect_rc 2
expect_calls "issue" 0
finish_case "$f0"

new_case "stale without a report"; f0=$fails
run_sync --state stale --commit x
expect_rc 2
finish_case "$f0"

echo "sync-drift-issue: $pass passed, $fails failed"
[ "$fails" -eq 0 ]
