#!/usr/bin/env bash
# resolve-platform-openapi.sh — find (and optionally download) the OpenAPI document Platform
# exported for its current `main` commit (change generated-types-follow-platform-main, design D2).
#
# Usage: resolve-platform-openapi.sh [--head <sha>] [--out-dir <dir>] <owner/repo>
#
#   --head <sha>    start from this commit instead of the repository's `main` head
#   --out-dir <dir> download the artifact there (`<dir>/openapi-document.json`); without it the
#                   script only resolves, which is how it is run read-only against real history
#
# Platform uploads `openapi-document-<sha>` for every commit whose CI ran the export, and skips
# the export for docs-only merges. So when the head has no artifact, the script walks back first
# parents (at most 30) to the newest commit that has one, and reuses its document only when GitHub's
# comparison of the two lists nothing but `*.md` files AND the list is complete (fewer than 300
# entries: the compare endpoint returns at most 300 files and does not page them).
#
# Output (stdout, `key=value`, ready for $GITHUB_OUTPUT): head, source, artifact, reused and, with
# --out-dir, document. On "source unavailable" it prints head, reason (and source when known).
#
# Exit codes: 0 a document was resolved (and downloaded, with --out-dir); 3 source unavailable,
# reason on stderr and as `reason=`; 2 usage. It never reports a document it could not obtain.
# Needs `gh` (authenticated through GH_TOKEN) and `jq`.
set -euo pipefail

MAX_BACK=30
MAX_FILES=300

head_sha=""
out_dir=""
repo=""
while [ $# -gt 0 ]; do
  case "$1" in
    --head) head_sha="${2:-}"; shift 2 ;;
    --out-dir) out_dir="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) [ -z "$repo" ] || { echo "unexpected argument: $1" >&2; exit 2; }; repo="$1"; shift ;;
  esac
done
if [ -z "$repo" ]; then
  echo "usage: resolve-platform-openapi.sh [--head <sha>] [--out-dir <dir>] <owner/repo>" >&2
  exit 2
fi

unavailable() { # unavailable <reason>
  echo "reason=$1"
  echo "source unavailable: $1" >&2
  exit 3
}

if [ -z "$head_sha" ]; then
  head_sha="$(gh api "repos/$repo/commits/main" | jq -r '.sha // empty')" ||
    unavailable "cannot read the main head of $repo"
  [ -n "$head_sha" ] || unavailable "cannot read the main head of $repo"
fi
if ! [[ "$head_sha" =~ ^[0-9a-f]{40}$ ]]; then
  # A short or symbolic --head: artifact names carry the full commit id.
  short="$head_sha"
  head_sha="$(gh api "repos/$repo/commits/$short" | jq -r '.sha // empty')" ||
    unavailable "cannot resolve commit $short in $repo"
  [ -n "$head_sha" ] || unavailable "cannot resolve commit $short in $repo"
fi
echo "head=$head_sha"

source_sha=""
run_id=""
commit="$head_sha"
for ((back = 0; back <= MAX_BACK; back++)); do
  artifacts="$(gh api "repos/$repo/actions/artifacts?name=openapi-document-$commit")" ||
    unavailable "cannot list the artifacts of $commit"
  live="$(printf '%s' "$artifacts" | jq -r '[.artifacts[] | select(.expired == false)] | sort_by(.id) | last | .workflow_run.id // empty')"
  if [ -n "$live" ]; then
    source_sha="$commit"
    run_id="$live"
    break
  fi
  if [ "$(printf '%s' "$artifacts" | jq '.artifacts | length')" -gt 0 ]; then
    echo "source=$commit"
    unavailable "artifact openapi-document-$commit has expired"
  fi
  [ "$back" -lt "$MAX_BACK" ] || break
  parent="$(gh api "repos/$repo/commits/$commit" | jq -r '.parents[0].sha // empty')" ||
    unavailable "cannot read the parent of $commit"
  [ -n "$parent" ] || break
  commit="$parent"
done
[ -n "$source_sha" ] ||
  unavailable "no openapi-document artifact on $head_sha or its $MAX_BACK first-parent ancestors"
echo "source=$source_sha"

if [ "$source_sha" != "$head_sha" ]; then
  compare="$(gh api "repos/$repo/compare/$source_sha...$head_sha")" ||
    unavailable "cannot compare $source_sha...$head_sha"
  status="$(printf '%s' "$compare" | jq -r '.status')"
  [ "$status" = ahead ] || unavailable "$head_sha is not ahead of $source_sha (status: $status)"
  # No `files` array at all is an unknown list, never an empty one.
  count="$(printf '%s' "$compare" | jq '.files | if type == "array" then length else -1 end')"
  [ "$count" -ge 0 ] ||
    unavailable "comparison $source_sha...$head_sha lists no files"
  [ "$count" -lt "$MAX_FILES" ] ||
    unavailable "comparison truncated: $source_sha...$head_sha lists $count files"
  # A rename names its old path in `previous_filename`: `Foo.cs` renamed to `Foo.md` removes a
  # non-Markdown file, so both names must be Markdown.
  other="$(printf '%s' "$compare" | jq -r '[.files[] | .filename, (.previous_filename // empty) | select(endswith(".md") | not)] | first // empty')"
  [ -z "$other" ] || unavailable "non-Markdown change between $source_sha and $head_sha: $other"
  echo "reused=true"
else
  echo "reused=false"
fi
artifact="openapi-document-$source_sha"
echo "artifact=$artifact"

if [ -n "$out_dir" ]; then
  mkdir -p "$out_dir"
  if ! msg="$(gh run download "$run_id" -R "$repo" -n "$artifact" -D "$out_dir" 2>&1)"; then
    unavailable "download refused for $artifact: $(printf '%s' "$msg" | tr '\n' ' ' | sed 's/ *$//')"
  fi
  [ -s "$out_dir/openapi-document.json" ] ||
    unavailable "$artifact holds no openapi-document.json"
  echo "document=$out_dir/openapi-document.json"
fi
