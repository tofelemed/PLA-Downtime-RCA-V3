#!/usr/bin/env bash
# verify-schema.sh <db> <schema>: one "<object class> <count>" line per class for the schema, sorted.
# Extension members (uuid-ossp, btree_gist ...) are not counted, so the TypeORM-built `public` schema
# and the `forge` schema built from db/migrations compare line for line.
# Connection: DB_CONTAINER (default instrumental-postgres), DB_USER, DB_PASSWORD (see lib.sh).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

[[ $# -eq 2 ]] || forge_die "usage: verify-schema.sh <db> <schema>"
db="$1"
schema="$2"
[[ "$schema" =~ ^[a-z_][a-z0-9_]*$ ]] || forge_die "schema must be a lowercase identifier"

forge_psql "$db" -At -v schema="$schema" <<'SQL'
WITH ns AS (SELECT oid FROM pg_namespace WHERE nspname = :'schema'),
ext AS (SELECT classid, objid FROM pg_depend WHERE deptype = 'e'),
rel AS (
  SELECT c.oid, c.relkind FROM pg_class c
  WHERE c.relnamespace = (SELECT oid FROM ns)
    AND NOT EXISTS (SELECT 1 FROM ext WHERE ext.classid = 'pg_class'::regclass AND ext.objid = c.oid)
),
counts(class, n) AS (
  SELECT 'tables', count(*) FROM rel WHERE relkind IN ('r', 'p')
  UNION ALL SELECT 'views', count(*) FROM rel WHERE relkind IN ('v', 'm')
  UNION ALL SELECT 'sequences', count(*) FROM rel WHERE relkind = 'S'
  UNION ALL SELECT 'indexes', count(*) FROM rel WHERE relkind IN ('i', 'I')
  UNION ALL SELECT 'columns', count(*) FROM pg_attribute a JOIN rel ON rel.oid = a.attrelid
    WHERE rel.relkind IN ('r', 'p', 'v', 'm') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL SELECT 'constraints', count(*) FROM pg_constraint WHERE connamespace = (SELECT oid FROM ns)
  UNION ALL SELECT 'triggers', count(*) FROM pg_trigger t JOIN rel ON rel.oid = t.tgrelid
    WHERE NOT t.tgisinternal
  UNION ALL SELECT 'policies', count(*) FROM pg_policy p JOIN rel ON rel.oid = p.polrelid
  UNION ALL SELECT 'functions', count(*) FROM pg_proc p WHERE p.pronamespace = (SELECT oid FROM ns)
    AND NOT EXISTS (SELECT 1 FROM ext WHERE ext.classid = 'pg_proc'::regclass AND ext.objid = p.oid)
  UNION ALL SELECT 'types', count(*) FROM pg_type t WHERE t.typnamespace = (SELECT oid FROM ns)
    AND t.typtype IN ('e', 'd', 'c', 'r', 'm')
    AND (t.typrelid = 0 OR EXISTS (SELECT 1 FROM rel WHERE rel.oid = t.typrelid AND rel.relkind = 'c'))
    AND NOT EXISTS (SELECT 1 FROM ext WHERE ext.classid = 'pg_type'::regclass AND ext.objid = t.oid)
)
SELECT class || ' ' || n FROM counts ORDER BY class;
SQL
