import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

/** table → FK name (TypeORM's name for `tenant_id` → `tenants.id`, so the entity relation matches). */
type TableFk = readonly [string, string];

/**
 * Tables converted together: the RCA family copies `tenant_id` between its tables by trigger
 * (`rca_tenant_propagates`, `rca_child_tenant_follows_rca`), so it is converted all or nothing.
 */
const GROUPS: ReadonlyArray<ReadonlyArray<TableFk>> = [
  [['pi_connections', 'FK_dc14cf1cea5a5b8eb72f6d95b3f']],
  [['assets', 'FK_35832939b4bc039606a21fc27ee']],
  [['products', 'FK_9c365ebf78f0e8a6d9e4827ea70']],
  [['production_plans', 'FK_0a60dfceafde9f802bdf5443304']],
  [['audit_logs', 'FK_6f18d459490bb48923b1f40bdb7']],
  [['rca_analysis_configs', 'FK_47db4c22f1a45dd6d8503df8dc4']],
  [['rca_trigger_configs', 'FK_632e962cb6b605ccb5a7d42ebf6']],
  [
    ['rcas', 'FK_f5f23f4d4c0af808efc3384f50b'],
    ['fmea_analyses', 'FK_fba9d32f43f51fc0b45c5a26a14'],
    ['five_why_analyses', 'FK_707919a300bbb088ba707dbe921'],
    ['fault_tree_analyses', 'FK_9caeb54c670d4b0d80c7d470c14'],
    ['fishbone_diagrams', 'FK_d099cf8e70daabd3851892d9b80'],
    ['barrier_analyses', 'FK_80e0ce436793d531e24612d2679'],
    ['change_analyses', 'FK_ce8e4d371840bbeff8beda50c8a'],
    ['rca_fmea_analyses', 'FK_ffae41607f1c369f1c87975ce83'],
    ['rca_five_why_analyses', 'FK_1614859f262a4b0df6cc307026b'],
    ['rca_fault_tree_analyses', 'FK_40bfa9eb36b30927422f2b51f42'],
    ['rca_fishbone_diagrams', 'FK_10c88127427a6b9e64da2bea0be'],
    ['rca_barrier_analyses', 'FK_b6a8953d43eaf93d4aa0898ebce'],
    ['rca_change_analyses', 'FK_4eab5ecd3f4166db8c7db5e17d2'],
    ['rca_knowledge_base', 'FK_52477a3c4a6cb7e34a8a27b8cb5'],
  ],
  [['production_events', 'FK_c5154628c51cdf276e6132dc3b9']],
];

const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const RLS_ROLE = 'proact_rls_user';
const EVENT_VIEW = 'failure_events_v';
/** Most orphan ids named in one migration NOTICE. */
const ORPHAN_IDS_SHOWN = 50;

const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;
const raise = (level: 'NOTICE' | 'WARNING', message: string) =>
  `DO $do$ BEGIN RAISE ${level} '%', ${quote(message)}; END $do$`;

/** `rca_shared_lessons()` as 1793960000000 created it, with the tenant comparison as `tenantJoin`. */
const sharedLessons = (tenantJoin: string, otherTenant: string) =>
  `CREATE OR REPLACE FUNCTION rca_shared_lessons(p_tenant uuid, p_limit int, p_before timestamptz, p_before_id uuid)
RETURNS TABLE ("id" uuid, "source_plant" varchar, "title" varchar, "problem_statement" text, "root_cause" text,
               "recommendations" text, "failure_mode" varchar, "equipment_category" varchar, "lesson_status" varchar,
               "shared_at" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kb."id", t."name", kb."title", kb."problem_statement", kb."root_cause", kb."recommendations",
         kb."failure_mode", kb."equipment_category", kb."lesson_status", kb."shared_at"
    FROM "rca_knowledge_base" kb
    JOIN "tenants" t ON ${tenantJoin} AND t."is_active"
   WHERE (app_rls_tenant_ids() IS NULL OR p_tenant::text = ANY (app_rls_tenant_ids()))
     AND t."organization_id" = (SELECT c."organization_id" FROM "tenants" c WHERE c."id" = p_tenant)
     AND ${otherTenant}
     AND kb."share_scope" = 'organization' AND kb."is_published" AND kb."shared_at" IS NOT NULL
     AND (p_before IS NULL OR (kb."shared_at", kb."id") < (p_before, p_before_id))
   ORDER BY kb."shared_at" DESC, kb."id" DESC
   LIMIT p_limit
$$`;
const SHARED_LESSONS_UUID = sharedLessons(
  't."id" = kb."tenant_id"',
  'kb."tenant_id" <> p_tenant',
);
const SHARED_LESSONS_TEXT = sharedLessons(
  't."id"::text = kb."tenant_id"',
  'kb."tenant_id" <> p_tenant::text',
);

/** The expand half of 1791584000000 (`tenant_uuid` kept in sync by trigger), restored by `down`. */
const TENANT_UUID_SYNC = [
  `ALTER TABLE "production_events" ADD "tenant_uuid" uuid`,
  `UPDATE "production_events" SET "tenant_uuid" = "tenant_id"::uuid WHERE "tenant_id" ~ '${UUID_PATTERN}'`,
  `CREATE FUNCTION "production_events_sync_tenant_uuid"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
    `BEGIN NEW."tenant_uuid" := CASE WHEN NEW."tenant_id" ~ '${UUID_PATTERN}' THEN NEW."tenant_id"::uuid ELSE NULL END; ` +
    `RETURN NEW; END $fn$`,
  `CREATE TRIGGER "trg_production_events_tenant_uuid" BEFORE INSERT OR UPDATE OF "tenant_id" ` +
    `ON "production_events" FOR EACH ROW EXECUTE FUNCTION "production_events_sync_tenant_uuid"()`,
];

/**
 * DB-05 (expert review), contract step of the varchar(36) → uuid tenant change for the core v1 tables
 * 1793970500000 left: production_events, audit_logs, production_plans, assets, products, pi_connections,
 * rcas with the RCA analysis tables, rca_knowledge_base, rca_analysis_configs and rca_trigger_configs.
 * - Per group: values that are not UUIDs leave the group unchanged with a WARNING (never rewritten or
 *   deleted). The RLS policy and any trigger pinned to `tenant_id` (`UPDATE OF tenant_id`) are dropped
 *   and recreated around the type change from their current definitions.
 * - production_events: `failure_events_v` is dropped and recreated from its current definition; the
 *   `tenant_uuid` shadow column, its sync trigger and function (expand step of 1791584000000) are
 *   dropped — readers use `tenant_id`. `rca_shared_lessons()` compares uuid to uuid.
 * - The FK is added NOT VALID; it is validated only when no row names an unknown tenant. Otherwise the
 *   orphan ids are listed in a NOTICE and the FK stays NOT VALID (new rows are still checked): business
 *   rows (production_plans) are not deleted silently, and audit rows are never deleted to satisfy an FK —
 *   the 30-day audit retention removes them, after which `VALIDATE CONSTRAINT` succeeds (DECISIONS).
 * Dev data (15 Oct 2026): 0 non-UUID values; orphans: audit_logs 314 (96 deleted test tenants),
 * production_plans 7, all other tables 0.
 * `down` restores varchar(36) without FKs, the shadow column with its trigger, and the text comparisons.
 */
export class CoreTenantUuid1794070000000 implements MigrationInterface {
  name = 'CoreTenantUuid1794070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const group of GROUPS) {
      if (await this.hasNonUuidValues(queryRunner, group)) continue;
      for (const [table, fk] of group) {
        await this.convert(queryRunner, table, fk);
      }
    }
    if (await this.isUuid(queryRunner, 'rca_knowledge_base')) {
      await queryRunner.query(SHARED_LESSONS_UUID);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const sharedLessonsWereUuid = await this.isUuid(
      queryRunner,
      'rca_knowledge_base',
    );
    for (const group of [...GROUPS].reverse()) {
      for (const [table, fk] of [...group].reverse()) {
        if (!(await this.isUuid(queryRunner, table))) continue;
        await queryRunner.query(
          `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fk}"`,
        );
        await this.withDependents(queryRunner, table, () =>
          this.retype(
            queryRunner,
            table,
            'character varying(36) USING "tenant_id"::text',
          ),
        );
      }
    }
    // A SQL function body is checked on CREATE, so the text comparison goes back after the column
    if (sharedLessonsWereUuid) await queryRunner.query(SHARED_LESSONS_TEXT);
  }

  private async convert(
    queryRunner: QueryRunner,
    table: string,
    fk: string,
  ): Promise<void> {
    await this.withDependents(queryRunner, table, async () => {
      if (table === 'production_events') {
        await this.dropTenantUuidShadow(queryRunner);
      }
      await this.retype(queryRunner, table, 'uuid USING "tenant_id"::uuid');
    });
    await queryRunner.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ` +
        `ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`,
    );
    await this.validateWhenClean(queryRunner, table, fk);
  }

  private async hasNonUuidValues(
    queryRunner: QueryRunner,
    group: ReadonlyArray<TableFk>,
  ): Promise<boolean> {
    for (const [table] of group) {
      if (await this.isUuid(queryRunner, table)) continue;
      const [{ bad }] = (await queryRunner.query(
        `SELECT count(*)::int AS "bad" FROM "${table}" WHERE "tenant_id" !~ '${UUID_PATTERN}'`,
      )) as Array<{ bad: number }>;
      if (bad === 0) continue;
      const tables = group.map(([name]) => name).join(', ');
      await queryRunner.query(
        raise(
          'WARNING',
          `${tables}: tenant_id kept varchar, ${table} has ${bad} value(s) that are not UUIDs`,
        ),
      );
      return true;
    }
    return false;
  }

  private async isUuid(
    queryRunner: QueryRunner,
    table: string,
  ): Promise<boolean> {
    const [column] = (await queryRunner.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`,
      [table],
    )) as Array<{ data_type: string }>;
    return column?.data_type === 'uuid';
  }

  /** Runs `work` with the views reading the table's `tenant_id` and its column triggers dropped. */
  private async withDependents(
    queryRunner: QueryRunner,
    table: string,
    work: () => Promise<void>,
  ): Promise<void> {
    const view =
      table === 'production_events'
        ? await this.dropView(queryRunner, EVENT_VIEW)
        : null;
    const triggers = (await queryRunner.query(
      `SELECT DISTINCT t."tgname" AS "name", pg_get_triggerdef(t."oid") AS "definition"
         FROM pg_trigger t
         JOIN pg_depend d ON d."classid" = 'pg_trigger'::regclass AND d."objid" = t."oid" AND d."refobjid" = t."tgrelid"
         JOIN pg_attribute a ON a."attrelid" = t."tgrelid" AND a."attnum" = d."refobjsubid"
        WHERE t."tgrelid" = $1::regclass AND NOT t."tgisinternal" AND a."attname" = 'tenant_id'`,
      [`public.${table}`],
    )) as Array<{ name: string; definition: string }>;
    for (const trigger of triggers) {
      await queryRunner.query(`DROP TRIGGER "${trigger.name}" ON "${table}"`);
    }
    await work();
    for (const trigger of triggers) {
      // The shadow-column trigger is gone for good once tenant_uuid is dropped
      if (trigger.name === 'trg_production_events_tenant_uuid') continue;
      await queryRunner.query(trigger.definition);
    }
    if (
      table === 'production_events' &&
      !(await this.isUuid(queryRunner, table))
    ) {
      for (const sql of TENANT_UUID_SYNC) await queryRunner.query(sql);
    }
    if (view) await this.createView(queryRunner, EVENT_VIEW, view);
  }

  private async dropTenantUuidShadow(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_production_events_tenant_uuid" ON "production_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "production_events_sync_tenant_uuid"()`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN IF EXISTS "tenant_uuid"`,
    );
  }

  /** Drops the view and returns its current definition (null when it does not exist). */
  private async dropView(
    queryRunner: QueryRunner,
    view: string,
  ): Promise<string | null> {
    const [row] = (await queryRunner.query(
      `SELECT pg_get_viewdef(c."oid") AS "definition" FROM pg_class c
        WHERE c."relname" = $1 AND c."relnamespace" = 'public'::regnamespace AND c."relkind" = 'v'`,
      [view],
    )) as Array<{ definition: string }>;
    if (!row) return null;
    await queryRunner.query(`DROP VIEW "${view}"`);
    return row.definition;
  }

  private async createView(
    queryRunner: QueryRunner,
    view: string,
    definition: string,
  ): Promise<void> {
    await queryRunner.query(`CREATE VIEW "${view}" AS ${definition}`);
    const roles = (await queryRunner.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [RLS_ROLE],
    )) as unknown[];
    if (roles.length > 0) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${view}" TO ${RLS_ROLE}`,
      );
    }
  }

  /** ALTER COLUMN TYPE with the tenant_isolation policy dropped and recreated around it. */
  private async retype(
    queryRunner: QueryRunner,
    table: string,
    type: string,
  ): Promise<void> {
    const policies = (await queryRunner.query(
      `SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = $1 AND policyname = 'tenant_isolation'`,
      [table],
    )) as unknown[];
    if (policies.length > 0) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "tenant_id" TYPE ${type}`,
    );
    if (policies.length > 0) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
      );
    }
  }

  /** VALIDATE when no row names an unknown tenant; otherwise list the orphan ids and keep NOT VALID. */
  private async validateWhenClean(
    queryRunner: QueryRunner,
    table: string,
    fk: string,
  ): Promise<void> {
    const [{ orphans, ids }] = (await queryRunner.query(
      `SELECT count(*)::int AS "orphans",
              string_agg("id", ', ' ORDER BY "id") FILTER (WHERE "n" <= ${ORPHAN_IDS_SHOWN}) AS "ids"
         FROM (SELECT o."id"::text AS "id", row_number() OVER (ORDER BY o."id") AS "n" FROM "${table}" o
                WHERE o."tenant_id" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM "tenants" x WHERE x."id" = o."tenant_id")) z`,
    )) as Array<{ orphans: number; ids: string | null }>;
    if (orphans === 0) {
      await queryRunner.query(
        `ALTER TABLE "${table}" VALIDATE CONSTRAINT "${fk}"`,
      );
      return;
    }
    const shown =
      orphans > ORPHAN_IDS_SHOWN ? ` (first ${ORPHAN_IDS_SHOWN})` : '';
    await queryRunner.query(
      raise('NOTICE', `${table} rows naming an unknown tenant${shown}: ${ids}`),
    );
    await queryRunner.query(
      raise(
        'WARNING',
        `${fk} on ${table} stays NOT VALID: ${orphans} row(s) name an unknown tenant`,
      ),
    );
  }
}
