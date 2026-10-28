#!/usr/bin/env bash
# Back up the Traverse Forge database schema and uploaded files (TF-PREP-001 task 7).
#   bash backup-forge.sh [--out <dir>]
# Output directory: --out, default $FORGE_HOME/backups. Writes, with one UTC timestamp:
#   traverse-forge-<DB_NAME>-<utc>.dump      pg_dump -Fc -n $DB_SCHEMA, run inside $DB_CONTAINER
#   traverse-forge-uploads-<utc>.tar.gz      the compose volume traverse-forge_forge-uploads, archived
#                                            with the tar of the running frontend image (no extra image
#                                            is needed on the air-gapped VM)
# each with a .sha256 file, all mode 600 in a mode 700 folder, then keeps the newest BACKUP_KEEP (default 14) of each kind. The database
# password reaches pg_dump as PGPASSWORD in the docker exec environment, never on a command line.
# Report exports (traverse-forge_forge-exports) are regenerable and not backed up.
set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

out="$FORGE_HOME/backups"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) [[ $# -ge 2 ]] || forge_die "usage: backup-forge.sh [--out <dir>]"; out="$2"; shift 2 ;;
    *) forge_die "usage: backup-forge.sh [--out <dir>]" ;;
  esac
done
vm_load_env
forge_check_db_env
container="${DB_CONTAINER:-instrumental-postgres}"
keep="${BACKUP_KEEP:-14}"
[[ "$keep" =~ ^[1-9][0-9]*$ ]] || forge_die "BACKUP_KEEP must be a positive integer"
vm_private_dir "$out"
out="$(cd "$out" && pwd)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
uploads_volume="${FORGE_PROJECT}_forge-uploads"
running="$(vm_read_version current-version)"
[[ -n "$running" ]] || forge_die "$FORGE_HOME/current-version is missing: start a release with load-and-start.sh first (its frontend image archives the uploads)"
vm_check_version "$running"

# write_sha256 <file>: <file>.sha256 in sha256sum format (checked with sha256sum -c from $out).
write_sha256() {
  printf '%s  %s\n' "$(forge_sha256 "$1")" "$(basename "$1")" > "$1.sha256"
  chmod 600 "$1" "$1.sha256"
}

# dump_database: custom-format dump of the schema; a partial file is removed on failure.
dump_database() {
  local file="$out/traverse-forge-$DB_NAME-$stamp.dump"
  if ! PGPASSWORD="${DB_PASSWORD:-}" MSYS_NO_PATHCONV=1 docker exec -e PGPASSWORD "$container" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -n "$DB_SCHEMA" -Fc > "$file"; then
    rm -f "$file"
    forge_die "pg_dump of $DB_NAME (schema $DB_SCHEMA) in $container failed"
  fi
  write_sha256 "$file"
  echo "$file"
}

# archive_uploads: tarball of the uploads volume (read-only mount) made by the BusyBox tar of the loaded
# frontend image. The container runs as root to read every file, then hands the archive to the invoking
# user with mode 600.
archive_uploads() {
  local name="traverse-forge-uploads-$stamp.tar.gz" image="traverse-forge-frontend:$running"
  docker volume inspect "$uploads_volume" >/dev/null 2>&1 || forge_die "volume $uploads_volume not found"
  docker image inspect "$image" >/dev/null 2>&1 || forge_die "image $image not found (current-version $running)"
  MSYS_NO_PATHCONV=1 docker run --rm --user 0 --entrypoint sh -e "OWNER=$(id -u):$(id -g)" \
    -v "$uploads_volume:/src:ro" -v "$(vm_host_path "$out"):/out" "$image" \
    -c 'tar czf "/out/$1" -C /src . && chown "$OWNER" "/out/$1" && chmod 600 "/out/$1"' sh "$name" ||
    { rm -f "$out/$name"; forge_die "archive of $uploads_volume failed"; }
  write_sha256 "$out/$name"
  echo "$out/$name"
}

# prune <prefix>: keep the newest $keep files <prefix>* (names sort by timestamp) and their .sha256.
prune() {
  local file
  find "$out" -maxdepth 1 -type f -name "$1*" ! -name '*.sha256' | LC_ALL=C sort -r | tail -n +"$((keep + 1))" |
    while IFS= read -r file; do
      rm -f "$file" "$file.sha256"
    done
}

dump_database
archive_uploads
prune "traverse-forge-$DB_NAME-"
prune "traverse-forge-uploads-"
