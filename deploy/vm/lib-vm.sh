#!/usr/bin/env bash
# Shared helpers for the deploy/vm scripts. Source it; it defines functions and FORGE_HOME only.
# Layout on the VM (FORGE_HOME, default /opt/traverse-forge):
#   .env                      runtime variables (template .env.example), never overwritten
#   releases/<version>/       one unpacked bundle per version (images.tar, db/, deploy/, compose file)
#   current-version           version started last by load-and-start.sh
#   previous-version          version that ran before it (rollback target)
#   private/                  generated passwords (mode 0700)
#   backups/                  database dumps and uploads archives of backup-forge.sh

vm_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../db/lib.sh
source "$vm_lib_dir/../db/lib.sh"

export FORGE_HOME="${FORGE_HOME:-/opt/traverse-forge}"
# Compose project name: prefixes the volumes (traverse-forge_forge-uploads, ...) and the network.
FORGE_PROJECT=traverse-forge

# vm_check_version <v>: a release name is letters, digits, dot, underscore and dash only.
vm_check_version() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || forge_die "invalid version name: '$1'"
}

# vm_private_dir <dir...>: create the folders for the owner only (mode 700). mkdir + chmod rather than
# `install -d -m 700`: under Git Bash on NTFS install fails on the mode, chmod is a no-op there.
vm_private_dir() {
  mkdir -p "$@"
  chmod 700 "$@"
}

# vm_release_dir <v>: the folder of an installed release.
vm_release_dir() {
  echo "$FORGE_HOME/releases/$1"
}

# vm_read_version <name>: content of $FORGE_HOME/<name> (current-version, previous-version), or empty.
vm_read_version() {
  local file="$FORGE_HOME/$1" value=""
  if [[ -f "$file" ]]; then
    value="$(tr -d '[:space:]' < "$file")"
  fi
  echo "$value"
}

# vm_write_version <name> <v>: write the version file atomically.
vm_write_version() {
  printf '%s\n' "$2" > "$FORGE_HOME/$1.tmp"
  mv -f "$FORGE_HOME/$1.tmp" "$FORGE_HOME/$1"
}

# vm_load_env: export the variables of $FORGE_HOME/.env (never printed); a value holding $ " ' # or
# whitespace is refused by forge_load_env, naming the variable only.
vm_load_env() {
  forge_load_env "$FORGE_HOME/.env"
}

# vm_placeholders <file>: names of the variables whose value still holds CHANGE_ME (FORGE_VERSION is
# set by load-and-start.sh and therefore ignored). Prints names only, never values.
vm_placeholders() {
  grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=.*CHANGE_ME' "$1" | grep -vE '^[[:space:]]*FORGE_VERSION=' |
    sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=.*/\1/' || true
}

# vm_compose <v> <compose args...>: docker compose for the release, project directory FORGE_HOME (so the
# compose file's env_file .env is $FORGE_HOME/.env). FORGE_COMPOSE_EXTRA holds extra "-f <file>"
# arguments (whitespace separated; the rehearsal adds deploy/docker-compose.local.yml).
vm_compose() {
  local version="$1" extra=()
  shift
  if [[ -n "${FORGE_COMPOSE_EXTRA:-}" ]]; then
    read -r -a extra <<<"$FORGE_COMPOSE_EXTRA"
  fi
  FORGE_VERSION="$version" docker compose -p "$FORGE_PROJECT" --project-directory "$FORGE_HOME" \
    --env-file "$FORGE_HOME/.env" -f "$(vm_release_dir "$version")/docker-compose.forge.yml" \
    ${extra[@]+"${extra[@]}"} "$@"
}

# vm_http_code <url>: HTTP status of a GET (000 when unreachable); curl, else BusyBox/GNU wget.
vm_http_code() {
  local code
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null)" || true
    echo "${code:-000}"
    return
  fi
  code="$(wget -S -q -O /dev/null -T 10 "$1" 2>&1 | awk '/^ *HTTP\// { c = $2 } END { print c }')" || true
  echo "${code:-000}"
}

# vm_http_body <url>: body of a GET (empty when unreachable).
vm_http_body() {
  if command -v curl >/dev/null 2>&1; then
    curl -s -m 10 "$1" 2>/dev/null || true
  else
    wget -q -O - -T 10 "$1" 2>/dev/null || true
  fi
}

# vm_host_path <path>: the path as docker sees it for a bind mount; under Git Bash the mixed Windows form
# (C:/...), which docker, Windows tools and bash all resolve. Unchanged on Linux.
vm_host_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    echo "$1"
  fi
}
