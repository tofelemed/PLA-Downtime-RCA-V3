# db/ — production database SQL (TF-PREP-001)

Production applies these files, in version order, to database `traverse_forge`, schema `forge`, on the
shared PostgreSQL 15 server. TypeORM migrations under `server/pro-act-backend/src/database/migrations`
remain the authoring tool; the files here are exported from them and never edited by hand.

| Path | Content |
|------|---------|
| `migrations/V001__baseline.sql` | Schema built by the TypeORM migrations through `1794241400000` (144 files), plus their `migrations` / `typeorm_metadata` rows, in schema `forge` |
| `CHECKSUMS.sha256` | SHA-256 of every `*.sql` under `db/` (`<sha256>  <path relative to db/>`) |

## Conventions

- Objects live in `forge`; the files set `search_path = forge, public`. Extensions (`uuid-ossp`,
  `btree_gist`, optional `pg_stat_statements`) stay in `public` and are created by
  `deploy/db/00-create-db-and-roles.sh`, as is the role `proact_rls_user`. No `CREATE ROLE` in `db/`.
- Grants to `proact_rls_user`: schema USAGE and per-table grants come from the migration files;
  default privileges for new objects come from `deploy/db/00-create-db-and-roles.sh`, which runs
  `ALTER DEFAULT PRIVILEGES FOR ROLE "$DB_USER" IN SCHEMA "$DB_SCHEMA"` (tables: SELECT, INSERT, UPDATE,
  DELETE; sequences: USAGE, SELECT, UPDATE) before V001 is applied, so tables created by V001 and by every
  later migration get their grants. The dev login's `ALTER DEFAULT PRIVILEGES` lines are not exported.
- An applied file never changes. A schema change is a new TypeORM migration exported as the next `V<nnn>`.
- Line endings are LF (`.gitattributes`), so checksums match on every checkout.

## Tooling (`deploy/db/`)

```bash
# Re-export the baseline (throwaway postgres:15-alpine container forge-export-pg on 127.0.0.1:55432)
bash deploy/db/export-baseline.sh --through 1794241400000 --out db/migrations/V001__baseline.sql
# Refresh / verify the checksums
bash deploy/db/checksums.sh
bash deploy/db/checksums.sh --check
# Object counts of one schema (compare TypeORM-built public with SQL-built forge)
DB_CONTAINER=<container> DB_USER=<user> DB_PASSWORD=<password> bash deploy/db/verify-schema.sh <db> <schema>
# Rewrite-rule unit test
bash deploy/db/tests/test-rewrite-schema.sh
```

Verification of V001: `deploy/db/tests/evidence/v001-verify.txt`.
