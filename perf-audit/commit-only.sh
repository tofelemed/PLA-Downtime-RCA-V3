#!/usr/bin/env bash
# Commits exactly the listed files (working-tree content, LF line endings) on top of HEAD, through a
# temporary index, so changes other people have staged or left in the working tree are not included.
# Only for files whose whole working-tree diff belongs to this commit; a listed path that no longer exists
# is removed.
#   perf-audit/commit-only.sh <message-file> <path>...
set -euo pipefail
MSG="$1"; shift
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TMP_INDEX="$(mktemp)"
BLOB="$(mktemp)"
trap 'rm -f "$TMP_INDEX" "$BLOB"' EXIT
GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD
for path in "$@"; do
  if [ ! -e "$path" ]; then
    GIT_INDEX_FILE="$TMP_INDEX" git update-index --force-remove "$path"
    continue
  fi
  tr -d '\r' < "$path" > "$BLOB"
  hash="$(git hash-object -w --no-filters "$BLOB")"
  GIT_INDEX_FILE="$TMP_INDEX" git update-index --add --cacheinfo "100644,$hash,$path"
done
GIT_INDEX_FILE="$TMP_INDEX" git diff --cached --stat HEAD
tree="$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)"
commit="$(git commit-tree "$tree" -p HEAD -F "$MSG")"
branch="$(git symbolic-ref HEAD)"
git update-ref -m "commit (commit-only.sh)" "$branch" "$commit" HEAD
git reset -q -- "$@"
git log --oneline -1
