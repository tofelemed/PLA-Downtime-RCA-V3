#!/usr/bin/env bash
# Rewrite db/CHECKSUMS.sha256 from every db/**/*.sql, or verify it with --check. DB_DIR overrides db/.
# db/seed/generated/ (git-ignored users seed) is left out; 20-seed-reference.sh checks it by row count.
#   bash deploy/db/checksums.sh            # write
#   bash deploy/db/checksums.sh --check    # exit 1 naming each mismatch
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

db_dir="$(cd "${DB_DIR:-$here/../../db}" && pwd)"
manifest="$db_dir/CHECKSUMS.sha256"

list_sql() {
  (cd "$db_dir" && find . -path ./seed/generated -prune -o -type f -name '*.sql' -print | sed 's|^\./||' |
    LC_ALL=C sort)
}

tmp=""
cleanup() {
  if [[ -n "$tmp" ]]; then rm -f "$tmp"; fi
}
trap cleanup EXIT

write_manifest() {
  local path
  tmp="$(mktemp)"
  while IFS= read -r path; do
    printf '%s  %s\n' "$(forge_sha256 "$db_dir/$path")" "$path" >> "$tmp"
  done < <(list_sql)
  mv "$tmp" "$manifest"
  tmp=""
  echo "wrote $(wc -l < "$manifest" | tr -d ' ') checksums to db/CHECKSUMS.sha256"
}

check_manifest() {
  local expected path actual bad=0
  [[ -f "$manifest" ]] || forge_die "db/CHECKSUMS.sha256 is missing"
  while read -r expected path; do
    if [[ ! -f "$db_dir/$path" ]]; then
      echo "missing: $path" >&2
      bad=1
      continue
    fi
    actual="$(forge_sha256 "$db_dir/$path")"
    if [[ "$actual" != "$expected" ]]; then
      echo "mismatch: $path" >&2
      bad=1
    fi
  done < "$manifest"
  while IFS= read -r path; do
    if ! cut -d' ' -f3- "$manifest" | grep -qxF -- "$path"; then
      echo "not in manifest: $path" >&2
      bad=1
    fi
  done < <(list_sql)
  (( bad == 0 )) || exit 1
  echo ok
}

case "${1:-}" in
  "") write_manifest ;;
  --check) check_manifest ;;
  *) forge_die "usage: checksums.sh [--check]" ;;
esac
