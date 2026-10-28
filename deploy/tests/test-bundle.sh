#!/usr/bin/env bash
# Build -> bundle -> install round trip without touching any running stack: builds images tagged t1,
# packages them into a bundle under a temp dir, installs it into a temp FORGE_HOME, and checks that
# load-and-start.sh refuses an unknown version and an .env that still holds CHANGE_ME (both refusals
# happen before any docker load or compose call). Finally `bash -n` on every script under deploy/.
# Removes the traverse-forge-*:t1 images and the temp dir on exit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy="$(cd "$here/.." && pwd)"
version=t1
work="$(mktemp -d)"

cleanup() {
  docker rmi "traverse-forge-backend:$version" "traverse-forge-frontend:$version" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

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

# truth <command...>: "true" when the command succeeds, else "false".
truth() {
  if "$@"; then echo true; else echo false; fi
}

# image_exists <ref>: the local image exists.
image_exists() {
  docker image inspect "$1" >/dev/null 2>&1
}

# run_rc <cmd...>: run the command, print "<exit code>|<combined output>".
run_rc() {
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  echo "$rc|$out"
}

# ended <code> <result> <needle...>: the run_rc result has that exit code and every needle in its output.
ended() {
  local code="$1" result="$2" needle
  shift 2
  [[ "${result%%|*}" == "$code" ]] || return 1
  for needle in "$@"; do
    [[ "$result" == *"$needle"* ]] || return 1
  done
}

rc=0
bash "$deploy/build/build-images.sh" --version "$version" --allow-dirty >"$work/build.log" 2>&1 || rc=$?
[[ $rc -eq 0 ]] || cat "$work/build.log" >&2
check "build-images.sh tags both images" "$( image_exists "traverse-forge-backend:$version" &&
  image_exists "traverse-forge-frontend:$version" && echo true || echo false)"

rc=0
bash "$deploy/build/package-bundle.sh" --version "$version" --out "$work/out" >"$work/package.log" 2>&1 || rc=$?
[[ $rc -eq 0 ]] || cat "$work/package.log" >&2
archive="$work/out/traverse-forge-$version.tar.gz"
check "package-bundle.sh writes the archive" "$(truth test -f "$archive")"

listing="$(tar tzf "$archive" 2>/dev/null || true)"
missing=""
for entry in images.tar db/migrations/V001__baseline.sql deploy/db/10-migrate.sh deploy/vm/load-and-start.sh \
  docker-compose.forge.yml VERSION MANIFEST.sha256 db/seed/generated/U010__users.sql; do
  grep -q "^traverse-forge-$version/$entry\$" <<<"$listing" || missing="$missing $entry"
done
check "bundle lists the release files (missing:$missing)" "$(truth test -z "$missing")"
check "package-bundle.sh says the users seed is included" \
  "$(truth grep -q '^users seed: included (sensitive)$' "$work/package.log")"

# A db/ copy without the generated users file: refused by default, packaged with --without-users.
cp -R "$deploy/../db" "$work/db-nousers"
rm -f "$work/db-nousers/seed/generated/U010__users.sql"
result="$(DB_DIR="$work/db-nousers" run_rc bash "$deploy/build/package-bundle.sh" --version "$version" \
  --out "$work/out-nousers")"
check "package-bundle.sh refuses a missing users seed (exit ${result%%|*})" \
  "$(truth ended 1 "$result" "U010__users.sql missing" --without-users)"
result="$(DB_DIR="$work/db-nousers" run_rc bash "$deploy/build/package-bundle.sh" --version "$version" \
  --out "$work/out-nousers" --without-users)"
listing="$(tar tzf "$work/out-nousers/traverse-forge-$version.tar.gz" 2>/dev/null || true)"
check "package-bundle.sh --without-users packages without it (exit ${result%%|*})" \
  "$( ended 0 "$result" "users seed: excluded (--without-users)" && [[ -n "$listing" ]] &&
  [[ "$listing" != *U010__users.sql* ]] && echo true || echo false)"

home="$work/home"
result="$(FORGE_HOME="$home" run_rc bash "$deploy/vm/install.sh" "$archive")"
check "install.sh installs t1 (exit ${result%%|*})" "$(truth ended 0 "$result" "installed $version at")"
check "install.sh creates .env and asks to edit it" \
  "$( [[ -f "$home/.env" && "$result" == *"ACTION: edit $home/.env"* ]] && echo true || echo false)"

start="$home/releases/$version/deploy/vm/load-and-start.sh"
result="$(FORGE_HOME="$home" run_rc bash "$start" t2)"
check "load-and-start.sh t2: unknown version refused (exit ${result%%|*})" \
  "$(truth ended 1 "$result" "unknown version")"
result="$(FORGE_HOME="$home" run_rc bash "$start" "$version")"
check "load-and-start.sh t1 refuses CHANGE_ME in .env (exit ${result%%|*})" \
  "$(truth ended 1 "$result" CHANGE_ME "$home/.env")"

syntax_errors=""
while IFS= read -r script; do
  bash -n "$script" 2>/dev/null || syntax_errors="$syntax_errors $script"
done < <(find "$deploy" -name '*.sh' -type f)
check "bash -n on every deploy script (failed:$syntax_errors)" "$(truth test -z "$syntax_errors")"

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
