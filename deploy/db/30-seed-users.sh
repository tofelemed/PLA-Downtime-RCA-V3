#!/usr/bin/env bash
# Create additional accounts from a CSV (TF-PREP-001 task 5) by running the compiled seed-users CLI inside
# the backend image on the database network.
#   bash deploy/db/30-seed-users.sh [--csv deploy/seed-users.csv] [--env <file>]
# CSV header: email,name,role,scope_role (see deploy/seed-users.csv.example). Random passwords are written
# to passwords-<date>.txt (mode 0600) next to the CSV; the CLI never prints them. The env file supplies
# DB_*, PG_NETWORK and FORGE_VERSION; TENANT_CODE (default HDPE-TRAIN) selects the tenant.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

csv="$here/../seed-users.csv"
env_arg=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv) [[ $# -ge 2 ]] || forge_die "usage: 30-seed-users.sh [--csv <file>] [--env <file>]"; csv="$2"; shift 2 ;;
    --env) [[ $# -ge 2 ]] || forge_die "usage: 30-seed-users.sh [--csv <file>] [--env <file>]"; env_arg="$2"; shift 2 ;;
    *) forge_die "usage: 30-seed-users.sh [--csv <file>] [--env <file>]" ;;
  esac
done

env_file="$(forge_env_file "$env_arg")"
forge_load_env "$env_file"
forge_check_db_env
[[ -f "$csv" ]] || forge_die "csv not found: $csv"
: "${PG_NETWORK:?PG_NETWORK is not set}"
: "${FORGE_VERSION:?FORGE_VERSION is not set}"

csv_abs="$(cd "$(dirname "$csv")" && pwd)/$(basename "$csv")"
out_dir="$(dirname "$csv_abs")"
out_name="passwords-$(date +%Y%m%d-%H%M%S).txt"

MSYS_NO_PATHCONV=1 docker run --rm --network "$PG_NETWORK" --env-file "$env_file" \
  -v "$csv_abs:/seed/users.csv:ro" -v "$out_dir:/seed/out" \
  "traverse-forge-backend:$FORGE_VERSION" \
  node dist/scripts/deploy/seed-users.js --csv /seed/users.csv \
  --tenant-code "${TENANT_CODE:-HDPE-TRAIN}" --out "/seed/out/$out_name"
echo "passwords file: $out_dir/$out_name (read it once, store it securely, then delete it)"
