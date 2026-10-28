#!/usr/bin/env bash
# Build the two production images of one release (TF-PREP-001 task 7), on the build workstation.
#   bash deploy/build/build-images.sh [--version <v>] [--allow-dirty]
# FORGE_VERSION = --version, else <yyyymmdd>-<short commit>. Tags traverse-forge-backend:<v> (context
# server/pro-act-backend) and traverse-forge-frontend:<v> (context: repository root) with the build
# arguments of deploy/BUILD-VARS.md. A working tree with uncommitted changes is refused unless
# --allow-dirty (the image would not match its GIT_COMMIT). Writes the version to deploy/build/.last-version.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
# shellcheck source=../db/lib.sh
source "$here/../db/lib.sh"

usage() {
  forge_die "usage: build-images.sh [--version <v>] [--allow-dirty]"
}

version=""
allow_dirty=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) [[ $# -ge 2 ]] || usage; version="$2"; shift 2 ;;
    --allow-dirty) allow_dirty=true; shift ;;
    *) usage ;;
  esac
done

# check_clean: refuse uncommitted changes to tracked files (as export-baseline.sh; submodules and nested
# worktrees are not part of any image).
check_clean() {
  local changes
  changes="$(git -C "$repo_root" status --porcelain --ignore-submodules=all --untracked-files=no)"
  [[ -z "$changes" ]] && return 0
  if [[ "$allow_dirty" == true ]]; then
    echo "warn: building from a working tree with uncommitted changes (--allow-dirty)" >&2
  else
    forge_die "working tree has uncommitted changes; commit them or pass --allow-dirty"
  fi
}

# build <image> <context>: docker build with the release build arguments.
build() {
  docker build -q -t "$1:$version" --build-arg "APP_VERSION=$version" --build-arg "GIT_COMMIT=$commit" \
    --build-arg "BUILD_DATE=$built_at" "$2" >/dev/null || forge_die "docker build of $1:$version failed"
  echo "built $1:$version"
}

commit="$(git -C "$repo_root" rev-parse HEAD)"
if [[ -z "$version" ]]; then
  version="$(date +%Y%m%d)-$(git -C "$repo_root" rev-parse --short HEAD)"
fi
[[ "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || forge_die "invalid version: '$version'"
[[ "$version" != latest ]] || forge_die "the tag latest is not used; pass a release version"
check_clean
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

build traverse-forge-backend "$repo_root/server/pro-act-backend"
build traverse-forge-frontend "$repo_root"
printf '%s\n' "$version" > "$here/.last-version"
