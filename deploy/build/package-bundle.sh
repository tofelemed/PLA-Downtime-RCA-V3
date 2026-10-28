#!/usr/bin/env bash
# Package one release into the offline bundle copied to the VM (TF-PREP-001 task 7).
#   bash deploy/build/package-bundle.sh [--version <v>] [--out <dir>]
# Version: --version, else deploy/build/.last-version (written by build-images.sh). Output directory:
# --out, default dist/bundle/ (git-ignored). The archive traverse-forge-<v>.tar.gz holds one folder
# traverse-forge-<v>/ with:
#   images.tar                 docker save of traverse-forge-backend:<v> and traverse-forge-frontend:<v>
#   db/                        migrations, reference seed, manifest, CHECKSUMS (seed/generated/ when present)
#   deploy/db/  deploy/vm/     database and VM scripts (deploy/db/tests is left out)
#   docker-compose.forge.yml  .env.example  seed-users.csv.example
#   VERSION                    FORGE_VERSION, GIT_COMMIT, BUILT_AT
#   MANIFEST.sha256            sha256sum of every other file (install.sh checks it with sha256sum -c)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
# shellcheck source=../db/lib.sh
source "$here/../db/lib.sh"

usage() {
  forge_die "usage: package-bundle.sh [--version <v>] [--out <dir>]"
}

version=""
out="$repo_root/dist/bundle"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) [[ $# -ge 2 ]] || usage; version="$2"; shift 2 ;;
    --out) [[ $# -ge 2 ]] || usage; out="$2"; shift 2 ;;
    *) usage ;;
  esac
done
if [[ -z "$version" && -f "$here/.last-version" ]]; then
  version="$(tr -d '[:space:]' < "$here/.last-version")"
fi
[[ -n "$version" ]] || forge_die "no version: pass --version or run build-images.sh first"
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || forge_die "invalid version: '$version'"
command -v sha256sum >/dev/null 2>&1 || forge_die "sha256sum is required"

images=("traverse-forge-backend:$version" "traverse-forge-frontend:$version")
name="traverse-forge-$version"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
staging="$out/.staging-$version"
release="$staging/$name"
archive="$out/$name.tar.gz"

cleanup() {
  rm -rf "$staging"
}
trap cleanup EXIT

# save_images: both images into images.tar (refuses when one is missing).
save_images() {
  local image
  for image in "${images[@]}"; do
    docker image inspect "$image" >/dev/null 2>&1 || forge_die "image $image not found: run build-images.sh"
  done
  docker save "${images[@]}" > "$release/images.tar" || forge_die "docker save failed"
}

# copy_files: database files, scripts, compose file and templates.
copy_files() {
  mkdir -p "$release/deploy"
  cp -R "$repo_root/db" "$release/db"
  cp -R "$repo_root/deploy/db" "$release/deploy/db"
  rm -rf "$release/deploy/db/tests"
  find "$release/deploy/db" -name '__pycache__' -type d -prune -exec rm -rf {} +
  cp -R "$repo_root/deploy/vm" "$release/deploy/vm"
  cp "$repo_root/deploy/docker-compose.forge.yml" "$repo_root/deploy/.env.example" \
    "$repo_root/deploy/seed-users.csv.example" "$release/"
}

# write_version: the release identity file.
write_version() {
  {
    echo "FORGE_VERSION=$version"
    echo "GIT_COMMIT=$(git -C "$repo_root" rev-parse HEAD)"
    echo "BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$release/VERSION"
}

# write_manifest: sha256sum of every file but the manifest itself, relative paths, sorted.
write_manifest() {
  local path
  (
    cd "$release"
    find . -type f ! -name MANIFEST.sha256 | sed 's|^\./||' | LC_ALL=C sort | while IFS= read -r path; do
      sha256sum "$path"
    done
  ) > "$staging/MANIFEST.sha256.tmp"
  mv "$staging/MANIFEST.sha256.tmp" "$release/MANIFEST.sha256"
}

rm -rf "$staging"
mkdir -p "$release"
save_images
copy_files
write_version
write_manifest
tar czf "$archive" -C "$staging" "$name" || forge_die "tar failed"
echo "bundle $archive ($(du -h "$archive" | cut -f1))"
