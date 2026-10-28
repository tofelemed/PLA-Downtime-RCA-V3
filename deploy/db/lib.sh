#!/usr/bin/env bash
# Shared helpers for the deploy/db scripts. Source it; it defines functions only.

# forge_die <msg>: print to stderr and exit 1.
forge_die() {
  echo "error: $*" >&2
  exit 1
}

# forge_load_env <file>: export every KEY=value line (comments and blank lines skipped). Never echoes.
forge_load_env() {
  local file="$1" line key value
  [[ -f "$file" ]] || forge_die "env file not found: $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done < "$file"
}

# forge_psql <db> [psql args...]: psql inside the database container; stdin is passed through.
# DB_CONTAINER defaults to instrumental-postgres; the password travels as PGPASSWORD in the
# environment of docker exec (never on a command line).
forge_psql() {
  local db="$1"
  shift
  [[ -n "${DB_USER:-}" ]] || forge_die "DB_USER is not set"
  PGPASSWORD="${DB_PASSWORD:-}" MSYS_NO_PATHCONV=1 docker exec -i -e PGPASSWORD \
    "${DB_CONTAINER:-instrumental-postgres}" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db" "$@"
}

# forge_sha256 <file>: print the hex SHA-256 digest of the file.
forge_sha256() {
  local digest
  if command -v sha256sum >/dev/null 2>&1; then
    digest="$(sha256sum "$1")"
  elif command -v shasum >/dev/null 2>&1; then
    digest="$(shasum -a 256 "$1")"
  else
    forge_die "neither sha256sum nor shasum is available"
  fi
  echo "${digest%% *}"
}

# forge_python [args...]: run Python 3 as python3 when that works, else python (Windows ships a
# python3 alias stub that only prints a Store hint, so being on PATH is not enough).
forge_python() {
  if python3 -c '' >/dev/null 2>&1; then
    python3 "$@"
  else
    python "$@"
  fi
}
