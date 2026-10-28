#!/usr/bin/env bash
# Apply the pending db/migrations/V<nnn>__<slug>.sql files in version order (TF-PREP-001 task 3).
#   bash deploy/db/10-migrate.sh [--env <file>] [--dry-run]
# Env file as in 00-create-db-and-roles.sh; DB_DIR overrides the SQL directory (default: db/ of the repo).
# Each pending file runs in one transaction together with its row in "$DB_SCHEMA".deploy_migrations and
# the proact_rls_user grants. A file that was applied with another checksum stops the run before
# anything is applied. --dry-run prints `apply|skip V<nnn>` per file and changes nothing.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

usage() {
  forge_die "usage: 10-migrate.sh [--env <file>] [--dry-run]"
}

env_arg=""
dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) [[ $# -ge 2 ]] || usage; env_arg="$2"; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    *) usage ;;
  esac
done
forge_load_env "$(forge_env_file "$env_arg")"
forge_check_db_env
[[ "$DB_SCHEMA" == forge ]] || forge_die "db/migrations target schema forge; DB_SCHEMA is $DB_SCHEMA"
db_dir="$(cd "${DB_DIR:-$here/../../db}" && pwd)"
export DB_DIR="$db_dir"

# query <sql>: unaligned tuples of the SQL in $DB_NAME.
query() {
  forge_psql "$DB_NAME" -X -q -At <<<"$1"
}

# pending_files: the V files in version order; refuses a name outside V<nnn>__<slug>.sql.
pending_files() {
  local path name
  while IFS= read -r path; do
    name="$(basename "$path")"
    [[ "$name" =~ ^V[0-9]{3}__[a-z0-9_]+\.sql$ ]] || forge_die "unexpected file name: migrations/$name"
    echo "$path"
  done < <(find "$db_dir/migrations" -maxdepth 1 -type f -name 'V*.sql' | LC_ALL=C sort)
}

# applied_by: who runs the migration (OS user and host), restricted to safe characters.
applied_by() {
  local who
  who="${USER:-${USERNAME:-unknown}}@$(hostname 2>/dev/null || echo unknown)"
  echo "${who//[^A-Za-z0-9_.@-]/_}"
}

# controls_transaction <path>: true when a line outside dollar-quoted bodies is BEGIN, START
# TRANSACTION, COMMIT, END, ABORT or ROLLBACK (the file would break out of the apply transaction).
controls_transaction() {
  awk '
    tag == "" && toupper($0) ~ /^[[:space:]]*(BEGIN|START TRANSACTION|COMMIT|END|ABORT|ROLLBACK)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;/ {
      found = 1; exit
    }
    {
      rest = $0
      while (match(rest, /\$([A-Za-z_][A-Za-z_0-9]*)?\$/)) {
        token = substr(rest, RSTART, RLENGTH)
        if (tag == "") tag = token; else if (token == tag) tag = ""
        rest = substr(rest, RSTART + RLENGTH)
      }
    }
    END { exit found ? 0 : 1 }
  ' "$1"
}

# apply_file <path> <version> <checksum>: file, ledger row and grants in one transaction.
apply_file() {
  local path="$1" version="$2" checksum="$3" file
  file="$(basename "$path")"
  {
    printf 'BEGIN;\nSET client_min_messages = warning;\nSET search_path = forge, public;\n'
    cat "$path"
    printf '\n;\nINSERT INTO "%s".deploy_migrations (version, file, checksum, applied_by)\n' "$DB_SCHEMA"
    printf "  VALUES ('%s', '%s', '%s', '%s');\n" "$version" "$file" "$checksum" "$(applied_by)"
    printf 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "%s" TO proact_rls_user;\n' "$DB_SCHEMA"
    printf 'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "%s" TO proact_rls_user;\n' "$DB_SCHEMA"
    printf 'COMMIT;\n'
  } | forge_psql "$DB_NAME" -X -q >/dev/null || forge_die "$version failed; its transaction was rolled back"
}

DB_DIR="$db_dir" bash "$here/checksums.sh" --check >/dev/null || forge_die "checksums.sh --check failed"
echo "checksums: ok"
[[ "$(query "SELECT to_regclass('\"$DB_SCHEMA\".deploy_migrations') IS NOT NULL;")" == t ]] ||
  forge_die "$DB_SCHEMA.deploy_migrations is missing: run 00-create-db-and-roles.sh first"

declare -A ledger=()
declare -A on_disk=()
ledger_rows="$(query "SELECT version || ' ' || checksum FROM \"$DB_SCHEMA\".deploy_migrations;")"
while read -r version checksum; do
  if [[ -n "$version" ]]; then ledger["$version"]="$checksum"; fi
done <<<"$ledger_rows"

# Plan first: a changed applied file, or a pending one that controls its own transaction, refuses
# the whole run before anything is applied.
plan=()
while IFS= read -r path; do
  version="$(basename "$path")"
  version="${version%%__*}"
  on_disk["$version"]=1
  checksum="$(forge_sha256 "$path")"
  if [[ -z "${ledger[$version]+set}" ]]; then
    ! controls_transaction "$path" || forge_die "$(basename "$path") controls its own transaction; refusing"
    plan+=("apply $version $checksum $path")
  elif [[ "${ledger[$version]}" == "$checksum" ]]; then
    plan+=("skip $version $checksum $path")
  else
    forge_die "$version was applied with checksum ${ledger[$version]}, file now has $checksum"
  fi
done < <(pending_files)
for version in "${!ledger[@]}"; do
  [[ -n "${on_disk[$version]+set}" ]] || echo "warn: ledger has $version but no file" >&2
done

applied=0
skipped=0
for entry in ${plan[@]+"${plan[@]}"}; do
  read -r action version checksum path <<<"$entry"
  echo "$action $version"
  if [[ "$action" == skip ]]; then
    skipped=$((skipped + 1))
  elif [[ "$dry_run" != true ]]; then
    apply_file "$path" "$version" "$checksum"
    applied=$((applied + 1))
  fi
done
if [[ "$dry_run" == true ]]; then
  echo "dry run: would apply $(( ${#plan[@]} - skipped )), skip $skipped"
else
  echo "migrations: applied $applied, skipped $skipped"
fi
