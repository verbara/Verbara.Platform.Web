#!/usr/bin/env bash
# api-types-freshness.sh — the steps of .github/workflows/api-types-freshness.yml (change
# generated-types-follow-platform-main, design D1-D6), kept in one script so they are tested
# (scripts/tests/test_api_types_freshness.sh) and can be run locally.
#
# Usage: api-types-freshness.sh --mode pr|issue [--platform-sha <sha>]
#
# resolve Platform's document (resolve-platform-openapi.sh, which downloads it) → regenerate the
# types into a temp file (generate-api-types.mjs --out) → format the committed and the regenerated
# file with the same prettier, `--config .prettierrc` named explicitly → compare by declaration
# block (check-api-types-fresh.py) → job summary.
#
#   --mode pr     stale: exit 1 (the check is red, not required); fresh: exit 0;
#                 source unavailable: a ::warning::, exit 0, and the summary says the copy was NOT
#                 checked (never "fresh", and nothing is regenerated or compared)
#   --mode issue  every outcome goes to sync-drift-issue.sh (stale / fresh / unavailable); exit 0
#                 unless the issue sync fails
#
# Environment: PLATFORM_REPO (default verbara/Verbara.Platform); GH_TOKEN for gh; GITHUB_STEP_SUMMARY
# (default: none); RUNNER_TEMP (default: the system temp dir); COMMITTED_TYPES (default: the
# committed src/core/api/generated/openapi.d.ts); GITHUB_SERVER_URL, GITHUB_REPOSITORY and
# GITHUB_RUN_ID name the run in the issue.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLATFORM_REPO="${PLATFORM_REPO:-verbara/Verbara.Platform}"
COMMITTED_TYPES="${COMMITTED_TYPES:-$ROOT/src/core/api/generated/openapi.d.ts}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

mode=""
platform_sha=""
while [ $# -gt 0 ]; do
  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --platform-sha) platform_sha="${2:-}"; shift 2 ;;
    *) echo "unexpected argument: $1" >&2; exit 2 ;;
  esac
done
case "$mode" in pr|issue) ;; *) echo "usage: api-types-freshness.sh --mode pr|issue [--platform-sha <sha>]" >&2; exit 2 ;; esac

run_url=""
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/$GITHUB_RUN_ID"
fi

work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/api-types-freshness.XXXXXX")"
trap 'rm -rf "$work"' EXIT

value() { sed -n "s/^$1=//p" "$work/resolve.out" | tail -n 1; } # value <key> from the resolver

sync_issue() { # sync_issue <state> [report [extra sync-drift-issue.sh args...]]
  local args=(--state "$1" --commit "$commits")
  [ -z "${2:-}" ] || args+=(--report "$2")
  args+=("${@:3}")
  [ -z "$run_url" ] || args+=(--run-url "$run_url")
  bash "$ROOT/scripts/ci/sync-drift-issue.sh" "${args[@]}"
}

resolve_args=(--out-dir "$work/doc")
[ -z "$platform_sha" ] || resolve_args+=(--head "$platform_sha")
set +e
bash "$ROOT/scripts/ci/resolve-platform-openapi.sh" "${resolve_args[@]}" "$PLATFORM_REPO" > "$work/resolve.out" 2> "$work/resolve.err"
rc=$?
set -e
cat "$work/resolve.err" >&2

head_sha="$(value head)"
source_sha="$(value source)"
commits="${source_sha:-${head_sha:-unknown}}"
if [ "$(value reused)" = true ]; then
  commits="$source_sha (document reused for the Markdown-only head $head_sha)"
fi

if [ "$rc" -eq 3 ]; then
  reason="$(value reason)"
  printf '%s\n' "$reason" > "$work/reason.txt"
  {
    echo "## Generated API types: source unavailable"
    echo
    echo "The committed copy was **not checked** against Platform."
    echo
    echo "- Platform head: \`${head_sha:-unknown}\`"
    echo "- Reason: $reason"
  } >> "$SUMMARY"
  if [ "$mode" = pr ]; then
    echo "::warning title=API types not checked::source unavailable for Platform commit ${head_sha:-unknown}: $reason"
    exit 0
  fi
  commits="${head_sha:-unknown}"
  sync_issue unavailable "$work/reason.txt"
  exit $?
fi
if [ "$rc" -ne 0 ]; then
  echo "::error::resolve-platform-openapi.sh failed with exit $rc" >&2
  exit 1
fi

artifact="$(value artifact)"
document="$(value document)"

node "$ROOT/scripts/generate-api-types.mjs" "$document" --out "$work/regenerated.d.ts"
cp "$COMMITTED_TYPES" "$work/committed.d.ts"
# Both sides through the same prettier, with the repo's config named explicitly (the files sit
# outside the checkout), so a formatting-only difference is never reported as drift.
(cd "$ROOT" && npx --no-install prettier --config "$ROOT/.prettierrc" --log-level warn \
  --write "$work/committed.d.ts" "$work/regenerated.d.ts")

set +e
python3 "$ROOT/scripts/check-api-types-fresh.py" "$work/committed.d.ts" "$work/regenerated.d.ts" > "$work/report.txt"
rc=$?
set -e
cat "$work/report.txt"

fix="gh run download -R $PLATFORM_REPO -n $artifact -D /tmp/openapi && OPENAPI_DOCUMENT_PATH=/tmp/openapi/openapi-document.json npm run generate:api-types"
case "$rc" in
  0)
    {
      echo "## Generated API types: fresh"
      echo
      echo "The committed copy equals the types generated from Platform commit \`$commits\` (\`$artifact\`)."
    } >> "$SUMMARY"
    if [ "$mode" = issue ]; then
      sync_issue fresh
      exit $?
    fi
    exit 0 ;;
  1)
    {
      echo "## Generated API types are stale"
      echo
      echo "Platform commit: \`$commits\` (\`$artifact\`)"
      echo
      echo '```text'
      cat "$work/report.txt"
      echo '```'
      echo
      echo "Refresh the copy (download the artifact first, then regenerate):"
      echo
      echo '```sh'
      echo "$fix"
      echo '```'
    } >> "$SUMMARY"
    if [ "$mode" = issue ]; then
      sync_issue stale "$work/report.txt" --artifact "$artifact"
      exit $?
    fi
    echo "::error title=API types are stale::the committed openapi.d.ts differs from Platform commit $commits; fix: $fix"
    exit 1 ;;
  *)
    echo "::error::check-api-types-fresh.py could not parse the files (exit $rc)" >&2
    exit 1 ;;
esac
