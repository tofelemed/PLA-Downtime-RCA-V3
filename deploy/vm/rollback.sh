#!/usr/bin/env bash
# Switch back to the release that ran before the current one (TF-PREP-001 task 7).
#   bash rollback.sh
# Reads $FORGE_HOME/previous-version (refuses when empty) and runs load-and-start.sh <previous>; its
# images are normally loaded already. The database is NOT rolled back: db/migrations V files are additive
# (new tables, columns, indexes), so the previous release keeps working on the newer schema. A release
# whose migration is not additive must ship its own rollback plan; restore a backup-forge.sh dump only
# under that plan. After a rollback, previous-version names the release that was rolled back.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

[[ $# -eq 0 ]] || forge_die "usage: rollback.sh"
previous="$(vm_read_version previous-version)"
[[ -n "$previous" ]] || forge_die "no previous version recorded in $FORGE_HOME/previous-version; nothing to roll back to"
vm_check_version "$previous"
[[ "$previous" != "$(vm_read_version current-version)" ]] || forge_die "previous-version equals current-version ($previous)"

bash "$here/load-and-start.sh" "$previous"
echo "rolled back to $previous"
