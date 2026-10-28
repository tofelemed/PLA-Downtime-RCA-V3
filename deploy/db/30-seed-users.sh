#!/usr/bin/env bash
# Create additional accounts from a CSV (TF-PREP-001 task 5) by running the compiled seed-users CLI inside
# the backend image on the database network.
#   bash deploy/db/30-seed-users.sh [--csv deploy/seed-users.csv] [--env <file>] [--out-dir <dir>]
# CSV header: email,name,role,scope_role (see deploy/seed-users.csv.example). Random passwords are written
# to <out-dir>/passwords-<date>.txt (mode 0600; out-dir defaults to ${FORGE_HOME:-/opt/traverse-forge}/private,
# created 0700, and must not be inside a git work tree); the CLI never prints them. The env file supplies
# DB_*, PG_NETWORK and FORGE_VERSION; TENANT_CODE (default HDPE-TRAIN) selects the tenant.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

csv="$here/../seed-users.csv"
out_dir="${FORGE_HOME:-/opt/traverse-forge}/private"
usage="usage: 30-seed-users.sh [--csv <file>] [--env <file>] [--out-dir <dir>]"
env_arg=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv) [[ $# -ge 2 ]] || forge_die "$usage"; csv="$2"; shift 2 ;;
    --env) [[ $# -ge 2 ]] || forge_die "$usage"; env_arg="$2"; shift 2 ;;
    --out-dir) [[ $# -ge 2 ]] || forge_die "$usage"; out_dir="$2"; shift 2 ;;
    *) forge_die "$usage" ;;
  esac
done

env_file="$(forge_env_file "$env_arg")"
forge_load_env "$env_file"
forge_check_db_env
[[ -f "$csv" ]] || forge_die "csv not found: $csv"
: "${PG_NETWORK:?PG_NETWORK is not set}"
: "${FORGE_VERSION:?FORGE_VERSION is not set}"

csv_abs="$(cd "$(dirname "$csv")" && pwd)/$(basename "$csv")"
mkdir -p -m 0700 "$out_dir"
out_dir="$(cd "$out_dir" && pwd)"
if git -C "$out_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  forge_die "refusing to write passwords inside a git work tree: $out_dir; pass --out-dir"
fi
out_name="passwords-$(date +%Y%m%d-%H%M%S).txt"

# host_path <path>: the path as docker sees it for a bind mount (Windows form under Git Bash).
host_path() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi
}

# --user: run as the invoking user so the (possibly 0600) CSV is readable and the 0700 out dir writable,
# and the passwords file is owned by that user rather than by the image user. --entrypoint node: the
# image's entrypoint starts the API and would swallow the CLI arguments.
MSYS_NO_PATHCONV=1 docker run --rm --user "$(id -u):$(id -g)" --network "$PG_NETWORK" --env-file "$env_file" \
  -v "$(host_path "$csv_abs"):/seed/users.csv:ro" -v "$(host_path "$out_dir"):/seed/out" \
  --entrypoint node "traverse-forge-backend:$FORGE_VERSION" \
  dist/scripts/deploy/seed-users.js --csv /seed/users.csv \
  --tenant-code "${TENANT_CODE:-HDPE-TRAIN}" --out "/seed/out/$out_name"
echo "passwords file: $out_dir/$out_name (read it once, store it securely, then delete it)"
