#!/usr/bin/env bash
# Re-extract the reference seed from the dev database proact (read-only) and refresh the checksums.
#   bash deploy/db/extract-reference-from-dev.sh [--tenant-code HDPE-TRAIN]
# Uses DB_* of server/pro-act-backend/.env. Writes db/seed/reference/R*.sql, db/seed/manifest.json and the
# git-ignored db/seed/generated/U010__users.sql, then runs checksums.sh. Review `git diff db/seed` before
# committing.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"
repo_root="$(cd "$here/../.." && pwd)"

tenant_code=HDPE-TRAIN
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant-code) [[ $# -ge 2 ]] || forge_die "usage: extract-reference-from-dev.sh [--tenant-code <code>]"
      tenant_code="$2"; shift 2 ;;
    *) forge_die "usage: extract-reference-from-dev.sh [--tenant-code <code>]" ;;
  esac
done

(cd "$repo_root/server/pro-act-backend" &&
  npm run -s deploy:extract-reference -- --tenant-code "$tenant_code" --out ../../db/seed) ||
  forge_die "extraction failed"
bash "$here/checksums.sh"
