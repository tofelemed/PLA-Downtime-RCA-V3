#!/usr/bin/env bash
# Start (or switch to) an installed release on the VM (TF-PREP-001 task 7).
#   bash load-and-start.sh <version>
# Refuses (exit 1) an unknown version (no $FORGE_HOME/releases/<v>/images.tar) and an .env that still
# holds CHANGE_ME (FORGE_VERSION aside: this script sets it). Loads the images unless both tags already
# exist, then requires `10-migrate.sh --dry-run` to list no `apply` (exit 2: migrate first). Records the
# running version in previous-version, runs the production compose (project traverse-forge, project
# directory $FORGE_HOME, extra -f files from FORGE_COMPOSE_EXTRA), writes current-version and the
# FORGE_VERSION line of .env, and finishes with verify.sh.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

[[ $# -eq 1 ]] || forge_die "usage: load-and-start.sh <version>"
version="$1"
vm_check_version "$version"
release="$(vm_release_dir "$version")"
env_file="$FORGE_HOME/.env"

# check_release: the release is installed and .env is filled in.
check_release() {
  local names
  [[ -f "$release/images.tar" ]] ||
    forge_die "unknown version refused: $version is not installed ($release/images.tar missing; run install.sh)"
  [[ -f "$env_file" ]] || forge_die "$env_file is missing: run install.sh first"
  names="$(vm_placeholders "$env_file" | tr '\n' ' ')"
  [[ -z "$names" ]] || forge_die "$env_file still contains CHANGE_ME for: ${names% }"
}

# load_images: docker load unless both tags are present already (rollback reuses loaded images).
load_images() {
  local image missing=false
  for image in "traverse-forge-backend:$version" "traverse-forge-frontend:$version"; do
    docker image inspect "$image" >/dev/null 2>&1 || missing=true
  done
  if [[ "$missing" == true ]]; then
    docker load < "$release/images.tar" >/dev/null || forge_die "docker load of $release/images.tar failed"
  fi
  for image in "traverse-forge-backend:$version" "traverse-forge-frontend:$version"; do
    docker image inspect "$image" >/dev/null 2>&1 || forge_die "image $image missing after docker load"
  done
  echo "images: traverse-forge-backend:$version traverse-forge-frontend:$version"
}

# check_migrations: the database already holds every migration of this release.
check_migrations() {
  local plan
  plan="$(DB_DIR="$release/db" bash "$release/deploy/db/10-migrate.sh" --env "$env_file" --dry-run)" ||
    forge_die "10-migrate.sh --dry-run failed"
  if grep -q '^apply ' <<<"$plan"; then
    grep '^apply ' <<<"$plan" >&2
    echo "run deploy/db/10-migrate.sh first" >&2
    exit 2
  fi
  echo "migrations: up to date"
}

# record_versions: remember the version being replaced (rollback target).
record_versions() {
  local current
  current="$(vm_read_version current-version)"
  if [[ -n "$current" && "$current" != "$version" ]]; then
    vm_write_version previous-version "$current"
  fi
}

# set_env_version: rewrite the FORGE_VERSION line of .env in place (mode and owner kept).
set_env_version() {
  local updated
  updated="$(awk -v v="$version" '
    /^[[:space:]]*FORGE_VERSION=/ { print "FORGE_VERSION=" v; done = 1; next }
    { print }
    END { if (!done) print "FORGE_VERSION=" v }
  ' "$env_file")"
  printf '%s\n' "$updated" > "$env_file"
}

check_release
vm_load_env
export FORGE_VERSION="$version"
load_images
check_migrations
record_versions
vm_compose "$version" up -d --remove-orphans || forge_die "docker compose up failed"
vm_write_version current-version "$version"
set_env_version
echo "started $version"
bash "$here/verify.sh" "$version"
