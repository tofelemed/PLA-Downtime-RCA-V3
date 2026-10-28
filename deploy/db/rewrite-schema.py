#!/usr/bin/env python3
r"""Rewrite a pg_dump of the TypeORM `public` schema so it builds the same objects in schema `forge`.

stdin -> stdout, standard library only. Rules (TF-PREP-001 task 2):
  1. Collect the names the dump creates in public: CREATE TABLE|TYPE|FUNCTION|PROCEDURE|SEQUENCE|VIEW|
     MATERIALIZED VIEW|DOMAIN public.<name>, the table and index name of CREATE ... INDEX <name> ON public.<t>,
     and the index behind ADD CONSTRAINT <name> PRIMARY KEY|UNIQUE|EXCLUDE (partition index attaches name
     those indexes schema-qualified).
  2. public.<name> -> forge.<name> for those names only, everywhere (function bodies included). Extension
     members (uuid_generate_v4, btree_gist operator classes ...) stay in public.
  3. Function search_path: `SET search_path = public, pg_temp` -> `SET search_path = forge, public, pg_temp`;
     pg_dump's form `SET search_path TO 'a', 'public', ...` gets 'forge' inserted before 'public'.
     to_regclass('public.' -> to_regclass('forge.'.
  4. pg_dump's empty search_path becomes CREATE SCHEMA IF NOT EXISTS forge + SET search_path = forge, public.
  5. pg_stat_statements is dropped (extensions are created by 00-create-db-and-roles.sh), and so are
     COMMENT ON EXTENSION statements (only the extension owner may run them).
  6. psql meta-commands \restrict, \unrestrict and \connect are removed.
"""
import re
import sys

IDENT = r'(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)'
CREATED = re.compile(
    r'\bCREATE (?:TABLE|TYPE|FUNCTION|PROCEDURE|SEQUENCE|VIEW|MATERIALIZED VIEW|DOMAIN) public\.(' + IDENT + ')'
)
INDEXED = re.compile(r'\bCREATE (?:UNIQUE )?INDEX (' + IDENT + r') ON (?:ONLY )?public\.(' + IDENT + ')')
CONSTRAINT_INDEX = re.compile(r'\bADD CONSTRAINT (' + IDENT + r') (?:PRIMARY KEY|UNIQUE|EXCLUDE)\b')
QUALIFIED = re.compile(r'(?<![A-Za-z0-9_$."])public\.(' + IDENT + ')')
FUNCTION_SEARCH_PATH = re.compile(r"^(\s+SET search_path TO )(.*)$", re.MULTILINE)

EMPTY_SEARCH_PATH = "SELECT pg_catalog.set_config('search_path', '', false);"
SCHEMA_PREAMBLE = "CREATE SCHEMA IF NOT EXISTS forge;\nSET search_path = forge, public;"
DROPPED_LINE = re.compile(
    r'^(?:\\(?:restrict|unrestrict|connect)\b.*'
    r'|CREATE EXTENSION .*\bpg_stat_statements\b.*'
    r'|COMMENT ON EXTENSION .*'
    r'|--.*\bpg_stat_statements\b.*)$'
)


def collect_names(sql: str) -> set:
    names = {m.group(1) for m in CREATED.finditer(sql)}
    for match in INDEXED.finditer(sql):
        names.update(match.groups())
    names.update(m.group(1) for m in CONSTRAINT_INDEX.finditer(sql))
    return names


def requalify(sql: str, names: set) -> str:
    def swap(match: re.Match) -> str:
        name = match.group(1)
        return f'forge.{name}' if name in names else match.group(0)

    return QUALIFIED.sub(swap, sql)


def rewrite_search_paths(sql: str) -> str:
    sql = sql.replace('SET search_path = public, pg_temp', 'SET search_path = forge, public, pg_temp')
    sql = FUNCTION_SEARCH_PATH.sub(
        lambda m: m.group(1) + m.group(2).replace("'public'", "'forge', 'public'"), sql
    )
    sql = sql.replace("to_regclass('public.'", "to_regclass('forge.'")
    return sql.replace(EMPTY_SEARCH_PATH, SCHEMA_PREAMBLE)


def drop_lines(sql: str) -> str:
    return ''.join(line for line in sql.splitlines(keepends=True) if not DROPPED_LINE.match(line.rstrip('\r\n')))


def rewrite(sql: str) -> str:
    sql = drop_lines(sql)
    sql = requalify(sql, collect_names(sql))
    return rewrite_search_paths(sql)


def main() -> None:
    sys.stdin.reconfigure(encoding='utf-8', newline='')
    sys.stdout.reconfigure(encoding='utf-8', newline='')
    sys.stdout.write(rewrite(sys.stdin.read()))


if __name__ == '__main__':
    main()
