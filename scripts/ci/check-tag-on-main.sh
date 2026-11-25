#!/usr/bin/env bash
# check-tag-on-main.sh — refuse a release whose tag points at a commit that is not on main.
#
# A `v*` tag builds, pushes and cosign-signs an image (release.yml), and CI only ever
# validated commits that reached `main` through a PR or the merge queue. A tag on any
# other commit would ship a signed image that no CI run checked, so the release job
# runs only after this check passes.
#
# Usage: check-tag-on-main.sh <commit-ish> [<main-ref>]
#   <commit-ish>  the tagged commit (release.yml passes $GITHUB_SHA); a tag name works too
#   <main-ref>    the ref that stands for main (default: origin/main)
#
# Exit 0: the commit is main's tip or one of its ancestors.
# Exit 1: anything else — off main, unresolvable commit or ref, or a shallow clone in
# which ancestry cannot be decided. Fail-closed: no case passes by default.
set -euo pipefail

COMMIT_IN="${1:?usage: check-tag-on-main.sh <commit-ish> [<main-ref>]}"
MAIN_REF="${2:-origin/main}"

refuse() {
  echo "::error title=tag-on-main::$1"
  exit 1
}

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  refuse "Shallow clone: ancestry of ${COMMIT_IN} cannot be decided. Check out with fetch-depth: 0."
fi

COMMIT="$(git rev-parse --verify --quiet "${COMMIT_IN}^{commit}")" \
  || refuse "${COMMIT_IN} does not resolve to a commit."
MAIN="$(git rev-parse --verify --quiet "${MAIN_REF}^{commit}")" \
  || refuse "${MAIN_REF} does not resolve to a commit; fetch main before this check."

if git merge-base --is-ancestor "$COMMIT" "$MAIN"; then
  echo "tag-on-main: ${COMMIT} is on ${MAIN_REF} (${MAIN})."
  exit 0
fi

refuse "${COMMIT_IN} (${COMMIT}) is not on ${MAIN_REF} (${MAIN}). Release tags are cut from main only: delete the tag, merge the change through a PR, and tag the merge commit."
