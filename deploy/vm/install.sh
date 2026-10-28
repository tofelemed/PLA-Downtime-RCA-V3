#!/usr/bin/env bash
# Unpack a release bundle on the VM (TF-PREP-001 task 7). Run as the deploy user with docker access.
#   FORGE_HOME=/opt/traverse-forge bash install.sh traverse-forge-<v>.tar.gz
# Extracts into $FORGE_HOME/releases/.incoming-*, checks MANIFEST.sha256 (sha256sum -c), then moves the
# release to $FORGE_HOME/releases/<v>/ (owner only: it holds password hashes). Copies .env.example to
# $FORGE_HOME/.env only when .env is missing (an existing .env is never touched). Does not start anything: current-version is not changed here
# (load-and-start.sh does that). Warns about variables of .env.example missing from .env, and when the
# database network or container named in .env is missing.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

[[ $# -eq 1 ]] || forge_die "usage: install.sh <traverse-forge-<version>.tar.gz>"
archive="$1"
[[ -f "$archive" ]] || forge_die "bundle not found: $archive"
command -v sha256sum >/dev/null 2>&1 || forge_die "sha256sum is required"

incoming=""
cleanup() {
  if [[ -n "$incoming" ]]; then rm -rf "$incoming"; fi
}
trap cleanup EXIT

# prepare_home: the FORGE_HOME folders; backups/ and private/ are for the deploy user only.
prepare_home() {
  mkdir -p "$FORGE_HOME/releases"
  vm_private_dir "$FORGE_HOME/backups" "$FORGE_HOME/private"
}

# unpack: extract the archive into $incoming and print the path of its single release folder.
unpack() {
  local folders
  tar xzf - -C "$incoming" < "$archive" || forge_die "cannot extract $archive"
  folders="$(find "$incoming" -mindepth 1 -maxdepth 1 -type d -name 'traverse-forge-*')"
  [[ -n "$folders" && "$folders" != *$'\n'* ]] || forge_die "bundle must hold one traverse-forge-<version>/ folder"
  echo "$folders"
}

# verify_manifest <dir>: every file listed in MANIFEST.sha256 matches.
verify_manifest() {
  [[ -f "$1/MANIFEST.sha256" ]] || forge_die "MANIFEST.sha256 missing from the bundle"
  (cd "$1" && sha256sum -c --quiet MANIFEST.sha256) || forge_die "MANIFEST.sha256 check failed: bundle damaged"
}

# bundle_version <dir>: FORGE_VERSION from the VERSION file, checked against the folder name.
bundle_version() {
  local version
  version="$(sed -n 's/^FORGE_VERSION=//p' "$1/VERSION" 2>/dev/null | tr -d '[:space:]')"
  vm_check_version "$version"
  [[ "$(basename "$1")" == "traverse-forge-$version" ]] || forge_die "VERSION ($version) does not match $(basename "$1")"
  echo "$version"
}

# install_env <release dir>: first install only; .env is created from the template, mode 600.
install_env() {
  [[ -f "$FORGE_HOME/.env" ]] && return 0
  cp "$1/.env.example" "$FORGE_HOME/.env"
  chmod 600 "$FORGE_HOME/.env"
  echo "ACTION: edit $FORGE_HOME/.env (replace every CHANGE_ME) before load-and-start.sh"
}

# check_env_keys <release dir>: warn about each variable of the release's .env.example that .env lacks
# (names only, never values).
check_env_keys() {
  local name
  while IFS= read -r name; do
    grep -q "^[[:space:]]*$name=" "$FORGE_HOME/.env" || echo "warn: .env lacks $name" >&2
  done < <(sed -n -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p' "$1/.env.example")
}

# check_database: the external network and the database container named in .env.
check_database() {
  local network container
  network="$(sed -n 's/^PG_NETWORK=//p' "$FORGE_HOME/.env" | tail -1)"
  container="$(sed -n 's/^DB_CONTAINER=//p' "$FORGE_HOME/.env" | tail -1)"
  network="${network:-instrumental-network}"
  container="${container:-instrumental-postgres}"
  docker network inspect "$network" >/dev/null 2>&1 || echo "warn: docker network $network not found (PG_NETWORK)" >&2
  docker inspect "$container" >/dev/null 2>&1 || echo "warn: database container $container not found (DB_CONTAINER)" >&2
}

prepare_home
incoming="$(mktemp -d "$FORGE_HOME/releases/.incoming-XXXXXX")"
folder="$(unpack)"
verify_manifest "$folder"
version="$(bundle_version "$folder")"
target="$(vm_release_dir "$version")"
[[ ! -e "$target" ]] || forge_die "release $version is already installed at $target"
mv "$folder" "$target"
# The release holds the accounts' password hashes (db/seed/generated): owner only.
chmod -R go-rwx "$target"
install_env "$target"
check_env_keys "$target"
check_database
echo "installed $version at $target"
