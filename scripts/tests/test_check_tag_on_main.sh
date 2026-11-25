#!/usr/bin/env bash
# test_check_tag_on_main.sh — unit tests for scripts/ci/check-tag-on-main.sh.
# Builds throwaway git repos and asserts the exit code. The negative cases are the
# point: a tag on a side branch, an unknown commit, a missing main ref and a shallow
# clone MUST all refuse (exit 1) before release.yml can build or sign anything.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SCRIPT_DIR/../ci/check-tag-on-main.sh"

fails=0
pass=0
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

# expect <expected-exit> <description> <repo> <args...>
expect() {
  local expected="$1" desc="$2" repo="$3" rc
  shift 3
  set +e
  (cd "$repo" && bash "$CHECK" "$@") >/dev/null 2>&1
  rc=$?
  set -e
  if [ "$rc" -eq "$expected" ]; then
    pass=$((pass + 1))
  else
    echo "FAIL: $desc — expected exit $expected, got $rc"
    fails=$((fails + 1))
  fi
}

g() { git -C "$REPO" "$@"; }

# A repo whose history is: c1 - c2 (main) and c1 - s1 (side).
# origin/main is a remote-tracking ref pointing at main's tip, as actions/checkout leaves it.
REPO="$SCRATCH/repo"
git init -q -b main "$REPO"
g config user.email t@t.t
g config user.name t
g config tag.gpgSign false
g config commit.gpgSign false
g commit -q --allow-empty -m c1
C1="$(g rev-parse HEAD)"
g commit -q --allow-empty -m c2
C2="$(g rev-parse HEAD)"
g update-ref refs/remotes/origin/main "$C2"
g checkout -q -b side "$C1"
g commit -q --allow-empty -m s1
S1="$(g rev-parse HEAD)"
g checkout -q main
g tag -a v1.0.0-web -m on-main "$C2"
g tag -a v0.9.0-web -m older "$C1"
g tag -a v1.0.1-web -m off-main "$S1"
g tag v1.0.2-web "$S1"

# --- passes ---
expect 0 "main tip"                         "$REPO" "$C2"
expect 0 "ancestor of main"                 "$REPO" "$C1"
expect 0 "annotated tag on main, by name"   "$REPO" v1.0.0-web
expect 0 "older annotated tag on main"      "$REPO" v0.9.0-web
expect 0 "explicit main ref"                "$REPO" "$C1" main

# --- refusals ---
expect 1 "commit on a side branch"          "$REPO" "$S1"
expect 1 "annotated tag off main"           "$REPO" v1.0.1-web
expect 1 "lightweight tag off main"         "$REPO" v1.0.2-web
expect 1 "unknown commit"                   "$REPO" 0123456789abcdef0123456789abcdef01234567
expect 1 "missing main ref"                 "$REPO" "$C2" origin/does-not-exist
expect 1 "main ref is the side branch"      "$REPO" "$C2" side

# A repo with no origin/main at all: the default ref must not resolve, and the check refuses.
BARE_MAIN="$SCRATCH/no-origin"
git init -q -b main "$BARE_MAIN"
git -C "$BARE_MAIN" -c user.email=t@t.t -c user.name=t commit -q --allow-empty -m only
expect 1 "default origin/main absent"       "$BARE_MAIN" HEAD

# A shallow clone: ancestry cannot be decided, so it refuses even for main's tip.
SHALLOW="$SCRATCH/shallow"
git clone -q --depth 1 "file://$REPO" "$SHALLOW"
expect 1 "shallow clone"                    "$SHALLOW" HEAD

# No argument at all is a usage error, never a pass.
expect 1 "no argument"                      "$REPO"

echo "check-tag-on-main: $pass passed, $fails failed"
[ "$fails" -eq 0 ]
