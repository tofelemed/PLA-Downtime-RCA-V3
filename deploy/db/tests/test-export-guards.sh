#!/usr/bin/env bash
# Guards of export-baseline.sh that need no database: a failing or incomplete migration:run aborts
# the export, and a flag without its value prints usage and exits 2. npm is stubbed on PATH and
# --stage-only keeps the script from starting a container or writing a file.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export_script="$here/../export-baseline.sh"
staging="$here/../../../server/pro-act-backend/src/database/migrations-export-tmp"
stub_dir="$(mktemp -d)"
trap 'rm -rf "$stub_dir"' EXIT

passed=0
failed=0

check() {
  if [[ "$2" == true ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "not ok: $1" >&2
  fi
}

# stub_npm <exit code> [output line]: an npm that prints the line and exits with the code.
stub_npm() {
  printf '#!/usr/bin/env bash\necho "%s"\nexit %s\n' "${2:-}" "$1" > "$stub_dir/npm"
  chmod +x "$stub_dir/npm"
}

# run_export [args...]: sets rc, stdout, stderr of export-baseline.sh with the stubbed npm first on PATH.
run_export() {
  local err_file="$stub_dir/stderr"
  rc=0
  stdout="$(PATH="$stub_dir:$PATH" bash "$export_script" "$@" 2> "$err_file")" || rc=$?
  stderr="$(cat "$err_file")"
}

stub_npm 1 "boom"
run_export --through 1794241400000 --stage-only
check "failing migration:run exits non-zero" "$([[ $rc -ne 0 ]] && echo true || echo false)"
check "failing migration:run is reported" "$([[ "$stderr" == *"migration:run failed"* ]] && echo true || echo false)"
check "failing migration:run prints no executed line" "$([[ "$stdout" != *executed* ]] && echo true || echo false)"
check "staging copy is removed after a failure" "$([[ ! -e "$staging" ]] && echo true || echo false)"

stub_npm 0 "Migration One1 has been  executed successfully."
run_export --through 1794241400000 --stage-only
check "incomplete migration:run exits non-zero" "$([[ $rc -ne 0 ]] && echo true || echo false)"
check "incomplete migration:run names the counts" \
  "$([[ "$stderr" == *"expected 144 migrations, executed 1"* ]] && echo true || echo false)"

run_export --through
check "flag without value exits 2" "$([[ $rc -eq 2 ]] && echo true || echo false)"
check "flag without value prints usage" "$([[ "$stderr" == usage:* ]] && echo true || echo false)"

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
