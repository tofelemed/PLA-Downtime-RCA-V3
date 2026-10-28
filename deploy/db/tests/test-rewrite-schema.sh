#!/usr/bin/env bash
# Feeds the fixture dump through rewrite-schema.py and checks each rewrite rule with grep -c.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../rewrite-schema.py"
fixture="$here/fixtures/dump-sample.sql"

if [[ ! -f "$script" ]]; then
  echo "FAIL: $script is missing" >&2
  exit 1
fi

out="$(python "$script" < "$fixture")"
passed=0
failed=0

# expect <description> <fixed-string pattern> <expected: present|absent>
expect() {
  local count
  count="$(grep -cF -- "$2" <<<"$out" || true)"
  if { [[ "$3" == present ]] && (( count > 0 )); } || { [[ "$3" == absent ]] && (( count == 0 )); }; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "not ok: $1 (pattern '$2' expected $3, found $count)" >&2
  fi
}

expect "table moves to forge" 'CREATE TABLE forge.units (' present
expect "extension member stays in public" 'DEFAULT public.uuid_generate_v4()' present
expect "enum column type moves to forge" 'status forge.units_status_enum' present
expect "function search_path (= form) puts forge first" 'SET search_path = forge, public, pg_temp' present
expect "schema is created" 'CREATE SCHEMA IF NOT EXISTS forge' present
expect "empty search_path is gone" "set_config('search_path', ''" absent
expect "pg_stat_statements is gone" 'pg_stat_statements' absent
expect "function search_path (TO form) puts forge first" "SET search_path TO 'pg_catalog', 'forge', 'public'" present
expect "partition lookup moves to forge" "to_regclass('forge.'" present
expect "function body moves to forge" 'SELECT 1 FROM forge.units' present
expect "partition index attach moves to forge" 'ALTER INDEX forge."PK_units" ATTACH PARTITION forge.units_y2026m10_pkey' present
expect "grant to the RLS role survives" 'GRANT SELECT ON TABLE forge.units TO proact_rls_user' present
expect "extension comments are gone" 'COMMENT ON EXTENSION' absent
expect "psql meta-commands are gone" '\restrict' absent
expect "psql unrestrict is gone" '\unrestrict' absent
expect "psql connect is gone" '\connect' absent
expect "schema USAGE grant moves to forge" 'GRANT USAGE ON SCHEMA forge TO proact_rls_user' present
expect "no schema grant left on public" 'ON SCHEMA public' absent
expect "default privileges are dropped" 'ALTER DEFAULT PRIVILEGES' absent
expect "default privileges comment block is dropped" 'DEFAULT PRIVILEGES FOR TABLES' absent
expect "typeorm_metadata row names schema forge" "INSERT INTO forge.typeorm_metadata VALUES ('GENERATED_COLUMN', 'traverse_forge', 'forge', 'units'" present
expect "typeorm_metadata row keeps no public literal" "'traverse_forge', 'public'" absent

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
