#!/usr/bin/env bash
# Bootstrap the production database (TF-PREP-001 task 3); idempotent, prints `ok|skip <step>` per step.
#   bash deploy/db/00-create-db-and-roles.sh [--env <file>]
# The env file (default ./.env, else $FORGE_HOME/.env) gives DB_CONTAINER, DB_USER, DB_PASSWORD, DB_NAME
# and DB_SCHEMA (default forge). Database and role are created through the maintenance database
# `postgres`; schema, extensions, grants, default privileges and the deploy_migrations ledger in $DB_NAME.
# It first checks the login's rights (`ok login-rights (...)`) and DB_PASSWORD over TCP (`ok password`).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

env_arg=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) [[ $# -ge 2 ]] || forge_die "usage: 00-create-db-and-roles.sh [--env <file>]"; env_arg="$2"; shift 2 ;;
    *) forge_die "usage: 00-create-db-and-roles.sh [--env <file>]" ;;
  esac
done
forge_load_env "$(forge_env_file "$env_arg")"
forge_check_db_env

# query <db> <sql>: run the SQL with psql variables db, user and schema; prints unaligned tuples only.
query() {
  forge_psql "$1" -X -q -At -v db="$DB_NAME" -v user="$DB_USER" -v schema="$DB_SCHEMA" <<<"$2"
}

# step <name> <db> <exists-sql> <create-sql>: skip when exists-sql returns t, else run create-sql.
step() {
  if [[ "$(query "$2" "$3")" == t ]]; then
    echo "skip $1"
  else
    query "$2" "$4" >/dev/null
    echo "ok $1"
  fi
}

# check_login_rights: the login is a superuser, or may create databases and roles (or a DBA created the
# database, proact_rls_user and the membership). A non-superuser also needs two grants only a superuser
# gives: SET on app.tenant_ids (V001 defines functions with `SET app.tenant_ids`) and BYPASSRLS (pg_dump in
# backup-forge.sh refuses tables with forced row-level security otherwise).
check_login_rights() {
  local rights super createdb createrole setparam bypass precreated mode="createdb+createrole" missing="" dba=""
  rights="$(query postgres "
    SELECT rolsuper, rolcreatedb, rolcreaterole, has_parameter_privilege('app.tenant_ids', 'SET'), rolbypassrls,
      EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') AND EXISTS (SELECT 1 FROM pg_auth_members m
        JOIN pg_roles r ON r.oid = m.roleid WHERE r.rolname = 'proact_rls_user' AND m.member = u.oid)
    FROM pg_roles u WHERE u.rolname = current_user;")"
  IFS='|' read -r super createdb createrole setparam bypass precreated <<<"$rights"
  if [[ "$super" == t ]]; then
    echo "ok login-rights (superuser)"
    return
  fi
  [[ "$createdb" == t ]] || missing="CREATEDB"
  [[ "$createrole" == t ]] || missing="${missing:+$missing and }CREATEROLE"
  if [[ -n "$missing" && "$precreated" == t ]]; then
    mode="pre-created by a DBA"
  elif [[ -n "$missing" ]]; then
    forge_die "$DB_USER lacks $missing: it needs SUPERUSER, or CREATEDB and CREATEROLE, or a DBA creates" \
      "database $DB_NAME, role proact_rls_user and its grant to $DB_USER"
  fi
  [[ "$setparam" == t ]] || dba="GRANT SET ON PARAMETER app.tenant_ids TO \"$DB_USER\";"
  [[ "$bypass" == t ]] || dba="${dba:+$dba }ALTER ROLE \"$DB_USER\" BYPASSRLS;"
  [[ -z "$dba" ]] || forge_die "$DB_USER lacks rights only a superuser grants; a superuser runs: $dba"
  echo "ok login-rights ($mode)"
}

# check_password: DB_PASSWORD over TCP to the container's own network address (the official image trusts
# 127.0.0.1 and the socket, so only a network connection checks the password, as the app's does).
check_password() {
  local container="${DB_CONTAINER:-instrumental-postgres}"
  PGPASSWORD="${DB_PASSWORD:-}" MSYS_NO_PATHCONV=1 docker exec -e PGPASSWORD -e PGUSER="$DB_USER" "$container" \
    sh -c 'psql -X -q -At -w -h "$(hostname -i | cut -d" " -f1)" -p 5432 -d postgres -c "select 1"' >/dev/null 2>&1 ||
    forge_die "DB_PASSWORD rejected by $container for $DB_USER"
  echo "ok password"
}

check_login_rights
check_password

step database postgres \
  "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db');" \
  'CREATE DATABASE :"db" OWNER :"user";'
step role postgres \
  "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proact_rls_user');" \
  'CREATE ROLE proact_rls_user NOLOGIN NOBYPASSRLS;'
step grant-role postgres \
  "SELECT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
     JOIN pg_roles u ON u.oid = m.member WHERE r.rolname = 'proact_rls_user' AND u.rolname = :'user');" \
  'GRANT proact_rls_user TO :"user";'
step schema "$DB_NAME" \
  "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :'schema');" \
  'CREATE SCHEMA IF NOT EXISTS :"schema" AUTHORIZATION :"user";'

for extension in uuid-ossp btree_gist; do
  step "extension $extension" "$DB_NAME" \
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = '$extension');" \
    "CREATE EXTENSION IF NOT EXISTS \"$extension\" SCHEMA public;"
done

# Schema USAGE for the RLS role, and default privileges of the deploy login so every table and
# sequence a migration creates in the schema is granted to proact_rls_user (7 privileges in all).
step default-privileges "$DB_NAME" \
  "SELECT has_schema_privilege('proact_rls_user', :'schema', 'USAGE') AND (
     SELECT count(*) FROM pg_default_acl d, aclexplode(d.defaclacl) a
     WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = :'user')
       AND d.defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = :'schema')
       AND a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'proact_rls_user')
       AND ((d.defaclobjtype = 'r' AND a.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
         OR (d.defaclobjtype = 'S' AND a.privilege_type IN ('USAGE', 'SELECT', 'UPDATE')))) = 7;" \
  'GRANT USAGE ON SCHEMA :"schema" TO proact_rls_user;
   ALTER DEFAULT PRIVILEGES FOR ROLE :"user" IN SCHEMA :"schema"
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO proact_rls_user;
   ALTER DEFAULT PRIVILEGES FOR ROLE :"user" IN SCHEMA :"schema"
     GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO proact_rls_user;'

step ledger "$DB_NAME" \
  "SELECT to_regclass(format('%I.deploy_migrations', :'schema')) IS NOT NULL;" \
  'CREATE TABLE IF NOT EXISTS :"schema".deploy_migrations (
     version text PRIMARY KEY,
     file text NOT NULL,
     checksum text NOT NULL,
     applied_at timestamptz NOT NULL DEFAULT now(),
     applied_by text NOT NULL
   );'

# pg_stat_statements is optional and last: a login that may not read shared_preload_libraries or
# create the (untrusted) extension gets a skip line instead of a failed bootstrap.
pg_stat_statements_step() {
  local preload
  if ! preload="$(query "$DB_NAME" 'SHOW shared_preload_libraries;' 2>/dev/null)"; then
    echo "skip: pg_stat_statements not available to $DB_USER"
  elif [[ "$preload" != *pg_stat_statements* ]]; then
    echo "skip: pg_stat_statements not preloaded"
  elif [[ "$(query "$DB_NAME" "SELECT EXISTS (SELECT 1 FROM pg_extension
      WHERE extname = 'pg_stat_statements');" 2>/dev/null)" == t ]]; then
    echo "skip extension pg_stat_statements"
  elif query "$DB_NAME" 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA public;' >/dev/null 2>&1; then
    echo "ok extension pg_stat_statements"
  else
    echo "skip: pg_stat_statements not available to $DB_USER"
  fi
}

pg_stat_statements_step
