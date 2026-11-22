#!/usr/bin/env bash
# sync-drift-issue.sh — keep the single `api-types-drift` issue in step with the freshness check's
# scheduled result (change generated-types-follow-platform-main, design D6).
#
# Usage: sync-drift-issue.sh --state stale|fresh|unavailable --commit <platform commit(s)>
#                            [--report <file>] [--run-url <url>]
#
#   stale        open the issue, or update the open one, with the changed routes and schemas
#                (--report: the checker's output) and the Platform commit
#   unavailable  the same issue, with a "Source unavailable" section (--report: the reason), so an
#                expired or refused source does not go silent
#   fresh        close the open issue with a comment naming the commit; nothing if none is open
#
# There is never more than one open issue with the label: if several are open, the oldest is the one
# acted on and the script exits 4, so the duplicate is visible instead of drifting. The workflow runs
# this job in one repository-wide concurrency group, so two runs cannot both create one.
# Exit codes: 0 done; 4 more than one open issue (the oldest was still updated or closed); 2 usage.
# Needs `gh` (GH_TOKEN with issues: write, GH_REPO) and `jq`.
set -euo pipefail

LABEL=api-types-drift
TITLE="Generated API types are out of step with Platform main"

state=""
commit=""
report=""
run_url=""
while [ $# -gt 0 ]; do
  case "$1" in
    --state) state="${2:-}"; shift 2 ;;
    --commit) commit="${2:-}"; shift 2 ;;
    --report) report="${2:-}"; shift 2 ;;
    --run-url) run_url="${2:-}"; shift 2 ;;
    *) echo "unexpected argument: $1" >&2; exit 2 ;;
  esac
done
case "$state" in
  stale|unavailable)
    if [ -z "$report" ] || [ ! -f "$report" ]; then
      echo "--state $state needs --report <file>" >&2
      exit 2
    fi ;;
  fresh) ;;
  *) echo "usage: sync-drift-issue.sh --state stale|fresh|unavailable --commit <sha> [--report <file>] [--run-url <url>]" >&2; exit 2 ;;
esac
[ -n "$commit" ] || { echo "--commit is required" >&2; exit 2; }

open="$(gh issue list --label "$LABEL" --state open --json number,createdAt --limit 100 |
  jq -r 'sort_by(.createdAt) | .[].number')"
count="$(printf '%s' "$open" | grep -c . || true)"
oldest="$(printf '%s\n' "$open" | head -n 1)"

duplicate() {
  if [ "$count" -gt 1 ]; then
    echo "::error::$count open issues carry the $LABEL label ($(printf '%s' "$open" | tr '\n' ' ' | sed 's/ *$//')); acted on the oldest, #$oldest. Close the others." >&2
    exit 4
  fi
}

if [ "$state" = fresh ]; then
  if [ "$count" -eq 0 ]; then
    echo "no open $LABEL issue; nothing to close"
    exit 0
  fi
  comment="The committed \`src/core/api/generated/openapi.d.ts\` is fresh again against Platform commit ${commit}."
  [ -z "$run_url" ] || comment="$comment Run: $run_url"
  gh issue close "$oldest" --comment "$comment"
  echo "closed #$oldest"
  duplicate
  exit 0
fi

body="$(mktemp)"
trap 'rm -f "$body"' EXIT
{
  echo "<!-- Maintained by .github/workflows/api-types-freshness.yml; closes itself when the copy is fresh. -->"
  if [ "$state" = stale ]; then
    echo "## Stale copy"
    echo
    echo "The committed \`src/core/api/generated/openapi.d.ts\` differs from the types generated from Platform's document."
    echo
    echo "Platform commit: $commit"
    echo
    echo '```text'
    cat "$report"
    echo '```'
    echo
    echo "To refresh the copy, download the artifact and regenerate:"
    echo
    echo '```sh'
    echo "gh run download -R verbara/Verbara.Platform -n openapi-document-<sha> -D /tmp/openapi"
    echo "OPENAPI_DOCUMENT_PATH=/tmp/openapi/openapi-document.json npm run generate:api-types"
    echo '```'
  else
    echo "## Source unavailable"
    echo
    echo "The committed copy was **not checked**: no usable Platform document could be obtained."
    echo
    echo "Platform commit: $commit"
    echo
    echo '```text'
    cat "$report"
    echo '```'
  fi
  if [ -n "$run_url" ]; then
    echo
    echo "Run: $run_url"
  fi
} > "$body"

if [ "$count" -eq 0 ]; then
  if ! gh label list --json name --limit 200 | jq -e --arg l "$LABEL" 'any(.[]; .name == $l)' > /dev/null; then
    gh label create "$LABEL" --color D93F0B \
      --description "The committed generated API types differ from Platform main's document"
  fi
  gh issue create --title "$TITLE" --label "$LABEL" --body-file "$body"
  exit 0
fi
gh issue edit "$oldest" --body-file "$body"
echo "updated #$oldest"
duplicate
