#!/usr/bin/env bash
# test_resolve_platform_openapi.sh — unit tests for scripts/ci/resolve-platform-openapi.sh
# (change generated-types-follow-platform-main, design D2). `gh` is replaced by a stub on
# PATH that serves fixture JSON and logs every call, so each case asserts both the verdict
# and what the resolver asked GitHub for. "Source unavailable" (exit 3) is the fail-closed
# side: a truncated or non-Markdown comparison, an expired artifact or a refused download
# MUST never resolve. Pure bash + jq, no network.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVE="$SCRIPT_DIR/../ci/resolve-platform-openapi.sh"
REPO="verbara/Verbara.Platform"

fails=0
pass=0

fail() {
  echo "FAIL: $CASE — $*"
  fails=$((fails + 1))
}

ok() { pass=$((pass + 1)); }

# new_case <description> — a fresh fixture dir with the gh stub first on PATH.
new_case() {
  CASE="$1"
  STUB_DIR="$(mktemp -d)"
  mkdir -p "$STUB_DIR/bin"
  cat > "$STUB_DIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/calls.log"
if [ "$1" = api ]; then
  ep="$2"
  case "$ep" in
    repos/*/actions/artifacts\?name=openapi-document-*)
      f="$STUB_DIR/artifacts_${ep##*name=openapi-document-}.json"
      if [ ! -f "$f" ]; then echo '{"total_count":0,"artifacts":[]}'; exit 0; fi ;;
    repos/*/commits/*) f="$STUB_DIR/commit_${ep##*/commits/}.json" ;;
    repos/*/compare/*) r="${ep##*/compare/}"; f="$STUB_DIR/compare_${r%%...*}_${r##*...}.json" ;;
    *) f="" ;;
  esac
  if [ -n "$f" ] && [ -f "$f" ]; then cat "$f"; exit 0; fi
  echo "gh: Not Found (HTTP 404)" >&2
  exit 1
fi
if [ "$1" = run ] && [ "$2" = download ]; then
  if [ -f "$STUB_DIR/download_refused" ]; then
    echo "error fetching artifacts: HTTP 403: Resource not accessible by integration" >&2
    exit 1
  fi
  dir=""
  while [ $# -gt 0 ]; do [ "$1" = -D ] && dir="$2"; shift; done
  mkdir -p "$dir"
  printf '{"openapi":"3.1.0","paths":{}}\n' > "$dir/openapi-document.json"
  exit 0
fi
echo "stub gh: unexpected call: $*" >&2
exit 99
STUB
  chmod +x "$STUB_DIR/bin/gh"
  : > "$STUB_DIR/calls.log"
}

sha() { printf '%040d' "$1"; } # sha <n> — a 40-char fake commit id

# commit_fixture <n> <parent-n> — commit n whose first parent is parent-n.
commit_fixture() {
  printf '{"sha":"%s","parents":[{"sha":"%s"}]}\n' "$(sha "$1")" "$(sha "$2")" > "$STUB_DIR/commit_$(sha "$1").json"
}

main_is() { printf '{"sha":"%s","parents":[{"sha":"%s"}]}\n' "$(sha "$1")" "$(sha "$2")" > "$STUB_DIR/commit_main.json"; }

# artifact_fixture <n> [expired] — commit n has an openapi-document artifact.
artifact_fixture() {
  local expired="${2:-false}"
  printf '{"total_count":1,"artifacts":[{"id":%d,"name":"openapi-document-%s","expired":%s,"workflow_run":{"id":%d,"head_sha":"%s"}}]}\n' \
    "$((1000 + $1))" "$(sha "$1")" "$expired" "$((5000 + $1))" "$(sha "$1")" > "$STUB_DIR/artifacts_$(sha "$1").json"
}

# compare_fixture <base-n> <head-n> <file>... — the files GitHub lists for base...head.
compare_fixture() {
  local base="$1" head="$2"
  shift 2
  local files
  files="$(printf '%s\n' "$@" | jq -R '{filename: .}' | jq -s .)"
  jq -n --argjson f "$files" '{status: "ahead", files: $f}' > "$STUB_DIR/compare_$(sha "$base")_$(sha "$head").json"
}

# run_resolver [args...] — sets RC, OUT, ERR.
run_resolver() {
  set +e
  OUT="$(PATH="$STUB_DIR/bin:$PATH" STUB_DIR="$STUB_DIR" bash "$RESOLVE" "$@" 2> "$STUB_DIR/stderr")"
  RC=$?
  set -e
  ERR="$(cat "$STUB_DIR/stderr")"
}

expect_rc() { [ "$RC" = "$1" ] || fail "expected exit $1, got $RC (stdout: $OUT; stderr: $ERR)"; }
expect_out() { printf '%s\n' "$OUT" | grep -qxF -- "$1" || fail "stdout lacks line '$1' (stdout: $OUT)"; }
expect_err() { printf '%s\n' "$ERR" | grep -qF -- "$1" || fail "stderr lacks '$1' (stderr: $ERR)"; }
expect_calls() { # expect_calls <fixed-string> <count>
  local n
  n="$(grep -cF -- "$1" "$STUB_DIR/calls.log" || true)"
  [ "$n" = "$2" ] || fail "expected $2 call(s) matching '$1', got $n"
}
finish_case() { [ "$fails" = "$1" ] && ok; rm -rf "$STUB_DIR"; }

# --- the head has an artifact ---
new_case "head has an artifact"; f0=$fails
main_is 10 9; artifact_fixture 10
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 0
expect_out "head=$(sha 10)"; expect_out "source=$(sha 10)"; expect_out "reused=false"
expect_out "artifact=openapi-document-$(sha 10)"; expect_out "document=$STUB_DIR/dl/openapi-document.json"
[ -f "$STUB_DIR/dl/openapi-document.json" ] || fail "document not downloaded"
expect_calls "api repos/$REPO/commits/main" 1
expect_calls "compare/" 0
expect_calls "run download 5010 -R $REPO -n openapi-document-$(sha 10)" 1
finish_case "$f0"

# --- the head is Markdown-only on top of an artifact ---
new_case "Markdown-only head on top of an artifact"; f0=$fails
main_is 10 9; commit_fixture 10 9; artifact_fixture 9
compare_fixture 9 10 CHANGELOG.md docs/guide.md openspec/specs/x/spec.md
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 0
expect_out "head=$(sha 10)"; expect_out "source=$(sha 9)"; expect_out "reused=true"
expect_out "artifact=openapi-document-$(sha 9)"
expect_calls "compare/$(sha 9)...$(sha 10)" 1
expect_calls "run download 5009 " 1
finish_case "$f0"

# --- --head names the starting commit instead of main ---
new_case "--head starts the walk at the given commit"; f0=$fails
commit_fixture 20 19; commit_fixture 19 18; artifact_fixture 18
compare_fixture 18 20 CHANGELOG.md
run_resolver --head "$(sha 20)" "$REPO"
expect_rc 0
expect_out "head=$(sha 20)"; expect_out "source=$(sha 18)"; expect_out "reused=true"
expect_calls "commits/main" 0
expect_calls "run download" 0
finish_case "$f0"

# --- a non-Markdown file sits in between ---
new_case "non-Markdown file between head and the artifact"; f0=$fails
main_is 10 9; commit_fixture 10 9; artifact_fixture 9
compare_fixture 9 10 CHANGELOG.md docs/assets/diagram.yaml
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 3
expect_out "reason=non-Markdown change between $(sha 9) and $(sha 10): docs/assets/diagram.yaml"
expect_err "source unavailable"
expect_calls "run download" 0
finish_case "$f0"

# --- no artifact within 30 commits ---
new_case "no artifact within 30 first-parent commits"; f0=$fails
main_is 100 99
for i in $(seq 100 -1 60); do commit_fixture "$i" "$((i - 1))"; done
run_resolver "$REPO"
expect_rc 3
expect_err "no openapi-document artifact on $(sha 100) or its 30 first-parent ancestors"
expect_calls "actions/artifacts?name=" 31
expect_calls "compare/" 0
finish_case "$f0"

# --- the comparison lists 300 files, all Markdown: truncated, never reused ---
new_case "comparison of 300 Markdown files is truncated"; f0=$fails
main_is 10 9; commit_fixture 10 9; artifact_fixture 9
mapfile_files=()
for i in $(seq 1 300); do mapfile_files+=("docs/page-$i.md"); done
compare_fixture 9 10 "${mapfile_files[@]}"
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 3
expect_out "reason=comparison truncated: $(sha 9)...$(sha 10) lists 300 files"
expect_calls "run download" 0
finish_case "$f0"

# --- 299 Markdown files are still a complete list ---
new_case "comparison of 299 Markdown files is complete"; f0=$fails
main_is 10 9; commit_fixture 10 9; artifact_fixture 9
compare_fixture 9 10 "${mapfile_files[@]:0:299}"
run_resolver "$REPO"
expect_rc 0
expect_out "source=$(sha 9)"
finish_case "$f0"

# --- the download is refused ---
new_case "download refused"; f0=$fails
main_is 10 9; artifact_fixture 10; touch "$STUB_DIR/download_refused"
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 3
expect_out "reason=download refused for openapi-document-$(sha 10): error fetching artifacts: HTTP 403: Resource not accessible by integration"
expect_out "source=$(sha 10)"
[ ! -e "$STUB_DIR/dl/openapi-document.json" ] || fail "a refused download left a document"
finish_case "$f0"

# --- the head's artifact has expired ---
new_case "expired artifact"; f0=$fails
main_is 10 9; artifact_fixture 10 true
run_resolver --out-dir "$STUB_DIR/dl" "$REPO"
expect_rc 3
expect_out "reason=artifact openapi-document-$(sha 10) has expired"
expect_calls "run download" 0
finish_case "$f0"

# --- usage ---
new_case "no repository argument"; f0=$fails
run_resolver
expect_rc 2
finish_case "$f0"

echo "resolve-platform-openapi: $pass passed, $fails failed"
[ "$fails" -eq 0 ]
