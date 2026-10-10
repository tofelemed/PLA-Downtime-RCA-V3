import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.11 (DB01, T14): the v1 RCA child tables get real foreign keys and follow their RCA's tenant.
 *
 * - The twelve analysis tables (`*_analyses`, `*_diagrams`, v1 and `rca_*` copies) had a varchar
 *   `rca_id` with no foreign key: it becomes `uuid` with `ON DELETE CASCADE`. Rows whose RCA does not
 *   exist (or whose `rca_id` is not a uuid) cannot be kept under the key: they are copied whole into
 *   `migration_review` (issue `RCA_CHILD_ORPHAN`, open for the data owner, 3.10 bookkeeping) and
 *   removed. `rca_knowledge_base` articles outlive their RCA: `rca_id` becomes nullable with
 *   `ON DELETE SET NULL`, and a dangling link is cleared (`RCA_LINK_CLEARED`, old value kept).
 * - `logic_tree_nodes`, `rca_evidence`, `rca_recommendations` already had a key; it now cascades.
 * - Tenant isolation: a child's `tenant_id` always equals its RCA's. Existing differences are aligned
 *   (`RCA_CHILD_TENANT_ALIGNED`, before value kept); trigger `trg_rca_child_tenant` sets the tenant from
 *   the RCA on every insert / re-link, and `trg_rca_tenant_propagates` follows an RCA's tenant change.
 *
 * `down()` restores the previous schema, the removed rows, the old tenants and the cleared links from
 * `migration_review`, then deletes this migration's bookkeeping rows. On the dev database (10 Oct 2026)
 * nothing was orphaned or misaligned.
 */
const JOB = 'rca-child-integrity';
const ACTOR = 'migration RcaChildIntegrity1793398400000';
const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/** child table → generated foreign key name (TypeORM naming, matches the entities) */
const ANALYSIS_TABLES: Readonly<Record<string, string>> = {
  fmea_analyses: 'FK_491a32514a4c2611323a3bc9869',
  five_why_analyses: 'FK_b3c45d6e6a61c86943298a702ef',
  fault_tree_analyses: 'FK_537bc41b31a70177f34238e934d',
  fishbone_diagrams: 'FK_20ce2e2e0b18596ad41f8a9459b',
  barrier_analyses: 'FK_8d42a346e61169120ae97510faf',
  change_analyses: 'FK_baf96330ad2e93bf54f06176899',
  rca_fmea_analyses: 'FK_97ae496f70b45daddfa927e0688',
  rca_fault_tree_analyses: 'FK_da67fcf410e52cca13513d5fbf2',
  rca_fishbone_diagrams: 'FK_3a1adec9dc81f00da6920ceda82',
  rca_barrier_analyses: 'FK_b452cba15c834ab797e539860b7',
  rca_change_analyses: 'FK_8b6ad2bccf50753849263a521ef',
  rca_five_why_analyses: 'FK_b3ca481cb9edf1c55d002aece95',
};
const KNOWLEDGE_TABLE = 'rca_knowledge_base';
const KNOWLEDGE_FK = 'FK_2454183612fe71f7fae2c463054';
const TENANT_TABLES = [...Object.keys(ANALYSIS_TABLES), KNOWLEDGE_TABLE];

/** tables that already had a key on "rcaId" (no tenant column): only the delete rule changes */
const CASCADED_KEYS: ReadonlyArray<[string, string]> = [
  ['rca_recommendations', 'FK_da1882bdc7e97c6f2169e95753f'],
  ['rca_evidence', 'FK_82d0f82dec4406f3cbd2df14bf4'],
  ['logic_tree_nodes', 'FK_791df580d6b173be0d1fb294f06'],
];

/** `rca_id` that does not name an existing RCA (not a uuid, or no such row) */
const DANGLING = `(c."rca_id" !~ '${UUID_PATTERN}' OR NOT EXISTS (SELECT 1 FROM "rcas" r WHERE r."id"::text = lower(c."rca_id")))`;

function reviewInsert(
  table: string,
  issue: string,
  details: string,
  where: string,
): string {
  const resolved = issue !== 'RCA_CHILD_ORPHAN';
  return `INSERT INTO "migration_review" ("tenant_id", "job", "legacy_table", "legacy_id", "issue", "details", "status", "report_id", "resolved_at", "resolved_by", "resolution")
    SELECT CASE WHEN c."tenant_id" ~ '${UUID_PATTERN}' THEN lower(c."tenant_id")::uuid END, '${JOB}', '${table}', c."id"::text, '${issue}', ${details},
           '${resolved ? 'resolved' : 'open'}', $1, ${resolved ? 'now()' : 'NULL'}, ${resolved ? `'${ACTOR}'` : 'NULL'},
           ${resolved ? `'applied by migration'` : 'NULL'}
      FROM "${table}" c WHERE ${where}`;
}

/** child tenant differs from its RCA's (only for rows whose RCA exists) */
const MISALIGNED = `EXISTS (SELECT 1 FROM "rcas" r WHERE r."id"::text = lower(c."rca_id") AND r."tenant_id" IS DISTINCT FROM c."tenant_id")`;

async function alignTenants(
  queryRunner: QueryRunner,
  table: string,
  reportId: string,
): Promise<void> {
  const details = `jsonb_build_object('before', c."tenant_id", 'after', (SELECT r."tenant_id" FROM "rcas" r WHERE r."id"::text = lower(c."rca_id")))`;
  await queryRunner.query(
    reviewInsert(table, 'RCA_CHILD_TENANT_ALIGNED', details, MISALIGNED),
    [reportId],
  );
  await queryRunner.query(
    `UPDATE "${table}" c SET "tenant_id" = r."tenant_id" FROM "rcas" r
      WHERE r."id"::text = lower(c."rca_id") AND r."tenant_id" IS DISTINCT FROM c."tenant_id"`,
  );
}

async function upAnalysisTable(
  queryRunner: QueryRunner,
  table: string,
  reportId: string,
): Promise<void> {
  await queryRunner.query(
    reviewInsert(table, 'RCA_CHILD_ORPHAN', 'to_jsonb(c)', DANGLING),
    [reportId],
  );
  await queryRunner.query(`DELETE FROM "${table}" c WHERE ${DANGLING}`);
  await alignTenants(queryRunner, table, reportId);
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "rca_id" TYPE uuid USING lower("rca_id")::uuid`,
  );
  await queryRunner.query(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${ANALYSIS_TABLES[table]}" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  );
}

async function upKnowledgeTable(
  queryRunner: QueryRunner,
  reportId: string,
): Promise<void> {
  const table = KNOWLEDGE_TABLE;
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "rca_id" DROP NOT NULL`,
  );
  await queryRunner.query(
    reviewInsert(
      table,
      'RCA_LINK_CLEARED',
      `jsonb_build_object('rca_id', c."rca_id")`,
      DANGLING,
    ),
    [reportId],
  );
  await queryRunner.query(
    `UPDATE "${table}" c SET "rca_id" = NULL WHERE ${DANGLING}`,
  );
  await alignTenants(queryRunner, table, reportId);
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "rca_id" TYPE uuid USING lower("rca_id")::uuid`,
  );
  await queryRunner.query(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${KNOWLEDGE_FK}" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  );
}

function propagateFunction(): string {
  const updates = TENANT_TABLES.map(
    (table) =>
      `UPDATE "${table}" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";`,
  ).join('\n    ');
  return `CREATE FUNCTION rca_tenant_propagates() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    ${updates}
    RETURN NEW;
  END $$`;
}

const CHILD_TENANT_FUNCTION = `CREATE FUNCTION rca_child_tenant_follows_rca() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW."rca_id" IS NOT NULL THEN
      SELECT r."tenant_id" INTO NEW."tenant_id" FROM "rcas" r WHERE r."id" = NEW."rca_id";
    END IF;
    RETURN NEW;
  END $$`;

async function installTriggers(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(CHILD_TENANT_FUNCTION);
  for (const table of TENANT_TABLES) {
    await queryRunner.query(
      `CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF "rca_id", "tenant_id" ON "${table}" FOR EACH ROW EXECUTE FUNCTION rca_child_tenant_follows_rca()`,
    );
  }
  await queryRunner.query(propagateFunction());
  await queryRunner.query(
    `CREATE TRIGGER trg_rca_tenant_propagates AFTER UPDATE OF "tenant_id" ON "rcas" FOR EACH ROW WHEN (OLD."tenant_id" IS DISTINCT FROM NEW."tenant_id") EXECUTE FUNCTION rca_tenant_propagates()`,
  );
}

async function dropTriggers(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `DROP TRIGGER IF EXISTS trg_rca_tenant_propagates ON "rcas"`,
  );
  await queryRunner.query(`DROP FUNCTION IF EXISTS rca_tenant_propagates()`);
  for (const table of TENANT_TABLES) {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_rca_child_tenant ON "${table}"`,
    );
  }
  await queryRunner.query(
    `DROP FUNCTION IF EXISTS rca_child_tenant_follows_rca()`,
  );
}

async function setCascade(
  queryRunner: QueryRunner,
  rule: 'CASCADE' | 'NO ACTION',
): Promise<void> {
  for (const [table, name] of CASCADED_KEYS) {
    await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    await queryRunner.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("rcaId") REFERENCES "rcas"("id") ON DELETE ${rule} ON UPDATE NO ACTION`,
    );
  }
}

const REVIEW_OF = (table: string, issue: string): string =>
  `r."job" = '${JOB}' AND r."legacy_table" = '${table}' AND r."issue" = '${issue}' AND r."legacy_id" = c."id"::text`;

async function downTenantTable(
  queryRunner: QueryRunner,
  table: string,
  fk: string,
): Promise<void> {
  await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "rca_id" TYPE character varying(36) USING "rca_id"::text`,
  );
  await queryRunner.query(
    `UPDATE "${table}" c SET "tenant_id" = r."details"->>'before' FROM "migration_review" r
      WHERE ${REVIEW_OF(table, 'RCA_CHILD_TENANT_ALIGNED')}`,
  );
  if (table === KNOWLEDGE_TABLE) {
    await queryRunner.query(
      `UPDATE "${table}" c SET "rca_id" = r."details"->>'rca_id' FROM "migration_review" r
        WHERE ${REVIEW_OF(table, 'RCA_LINK_CLEARED')}`,
    );
    // a link cleared later by an RCA delete has no old value: the v1 column was NOT NULL
    await queryRunner.query(
      `UPDATE "${table}" SET "rca_id" = '' WHERE "rca_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "rca_id" SET NOT NULL`,
    );
    return;
  }
  await queryRunner.query(
    `INSERT INTO "${table}" SELECT (jsonb_populate_record(NULL::"${table}", r."details")).*
       FROM "migration_review" r
      WHERE r."job" = '${JOB}' AND r."legacy_table" = '${table}' AND r."issue" = 'RCA_CHILD_ORPHAN'`,
  );
}

export class RcaChildIntegrity1793398400000 implements MigrationInterface {
  name = 'RcaChildIntegrity1793398400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [report] = (await queryRunner.query(
      `INSERT INTO "migration_reports" ("job", "tenant_id", "status", "actor", "database_name", "summary", "started_at", "finished_at")
       VALUES ($1, NULL, 'applied', $2, current_database(), '{}'::jsonb, now(), now()) RETURNING "id"`,
      [JOB, ACTOR],
    )) as Array<{ id: string }>;
    for (const table of Object.keys(ANALYSIS_TABLES)) {
      await upAnalysisTable(queryRunner, table, report.id);
    }
    await upKnowledgeTable(queryRunner, report.id);
    await setCascade(queryRunner, 'CASCADE');
    await installTriggers(queryRunner);
    await queryRunner.query(
      `UPDATE "migration_reports" SET "summary" = COALESCE((
         SELECT jsonb_object_agg("issue", n) FROM (
           SELECT "issue", count(*) AS n FROM "migration_review" WHERE "report_id" = $1 GROUP BY "issue") s), '{}'::jsonb)
       WHERE "id" = $1`,
      [report.id],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropTriggers(queryRunner);
    await setCascade(queryRunner, 'NO ACTION');
    for (const [table, fk] of Object.entries(ANALYSIS_TABLES)) {
      await downTenantTable(queryRunner, table, fk);
    }
    await downTenantTable(queryRunner, KNOWLEDGE_TABLE, KNOWLEDGE_FK);
    await queryRunner.query(`DELETE FROM "migration_review" WHERE "job" = $1`, [
      JOB,
    ]);
    await queryRunner.query(
      `DELETE FROM "migration_reports" WHERE "job" = $1`,
      [JOB],
    );
  }
}
