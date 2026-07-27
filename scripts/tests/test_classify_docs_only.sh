#!/usr/bin/env bash
# test_classify_docs_only.sh — unit tests for scripts/ci/classify-docs-only.sh (ADR-0016 §3.4).
# Builds a throwaway git repo, stages a diff between two commits, and asserts the
# classifier's docs_only verdict. Fail-closed cases are the point: a mis-widened
# allowlist (e.g. blanket **/*.md, or a nested code file) MUST classify as false
# before it can ever mis-skip a code PR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFY="$SCRIPT_DIR/../ci/classify-docs-only.sh"

fails=0
pass=0

# run_case <expected> <description> — the caller has already committed BASE and HEAD
# in $WORK; BASE is the first commit, HEAD is the current tip.
run_case() {
  local expected="$1" desc="$2" base head out
  base="$(git -C "$WORK" rev-parse HEAD~1)"
  head="$(git -C "$WORK" rev-parse HEAD)"
  out="$(cd "$WORK" && bash "$CLASSIFY" "$base" "$head")"
  if [ "$out" = "docs_only=$expected" ]; then
    pass=$((pass + 1))
  else
    echo "FAIL: $desc — expected docs_only=$expected, got '$out'"
    fails=$((fails + 1))
  fi
}

# empty_case <description> — asserts fail-closed on an empty diff (base==head).
empty_case() {
  local desc="$1" sha out
  sha="$(git -C "$WORK" rev-parse HEAD)"
  out="$(cd "$WORK" && bash "$CLASSIFY" "$sha" "$sha")"
  if [ "$out" = "docs_only=false" ]; then
    pass=$((pass + 1))
  else
    echo "FAIL: $desc — expected docs_only=false (empty diff), got '$out'"
    fails=$((fails + 1))
  fi
}

# new_repo — fresh git repo with a single seed commit, so HEAD~1 always exists.
new_repo() {
  WORK="$(mktemp -d)"
  git -C "$WORK" init -q
  git -C "$WORK" config user.email t@t.t
  git -C "$WORK" config user.name t
  git -C "$WORK" commit -q --allow-empty -m seed
}

commit() { # commit <file> <content>
  mkdir -p "$WORK/$(dirname "$1")"
  printf '%s\n' "$2" > "$WORK/$1"
  git -C "$WORK" add -A
  git -C "$WORK" commit -q -m "change $1"
}

# --- true cases (allowlisted) ---
new_repo; commit "docs/guide.md" x;        run_case true  "docs/ nested"
new_repo; commit "openspec/changes/x.md" x; run_case true  "openspec/ nested"
new_repo; commit "CHANGELOG.md" x;         run_case true  "top-level CHANGELOG.md"
new_repo; commit "README.md" x;            run_case true  "top-level README.md (matches */README.md? -> top-level *.md)"
new_repo; commit "src/feature/README.md" x; run_case true  "nested README.md at any depth"
new_repo; commit "NOTES.md" x;             run_case true  "top-level *.md"
new_repo
commit "docs/a.md" a
commit "docs/b.md" b
run_case true "two docs files"

# --- false cases (fail-closed) ---
new_repo; commit "src/app.ts" x;           run_case false "nested code file"
new_repo; commit "package.json" x;         run_case false "top-level non-md"
new_repo; commit "src/notes.md" x;         run_case false "nested non-README .md (blanket **/*.md is BANNED)"
new_repo; commit ".github/workflows/ci.yml" x; run_case false "workflow change (self-validation: this PR is NOT docs-only)"
new_repo
commit "docs/a.md" a
commit "src/app.ts" code
run_case false "mixed docs + code => false"

# rename: docs/old.md -> src/new.ts must classify BOTH paths (old doc + new code) => false
new_repo
commit "docs/old.md" content
git -C "$WORK" mv docs/old.md src/new.ts 2>/dev/null || { git -C "$WORK" rm -q docs/old.md; mkdir -p "$WORK/src"; printf 'content\n' > "$WORK/src/new.ts"; git -C "$WORK" add -A; }
git -C "$WORK" commit -q -m "rename docs/old.md -> src/new.ts"
run_case false "rename docs->code classifies both paths (--no-renames)"

# empty diff => fail-closed
new_repo
empty_case "empty diff => fail-closed"

echo "---"
echo "passed=$pass failed=$fails"
[ "$fails" -eq 0 ] || exit 1
echo "OK"
