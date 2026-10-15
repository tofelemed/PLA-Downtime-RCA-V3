import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const STATEMENTS = [
  `CREATE TABLE "restatement_postings" (${AUDIT}, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, ` +
    `"operational_effective_date" date NOT NULL, "posting_date" date NOT NULL, "treatment" character varying(24) NOT NULL, ` +
    `"note" text, "decided_by" uuid NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
    `CONSTRAINT "CHK_restatement_postings_treatment" CHECK ("treatment" IN ('correction', 'estimate_change', 'other_adjustment', 'no_posting')), ` +
    `CONSTRAINT "PK_1247696beb2d3ae84c162e66ddf" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_9fbf19e5e72ff36f825959e133" ON "restatement_postings" ("tenant_id")`,
  `CREATE INDEX "IDX_restatement_postings_tenant_period" ON "restatement_postings" ("tenant_id", "period_id")`,
  `CREATE UNIQUE INDEX "UQ_restatement_postings_revision" ON "restatement_postings" ("revision_id")`,
  `CREATE TABLE "source_status_mappings" (${AUDIT}, "source_system" character varying(64) NOT NULL, "version" integer NOT NULL, ` +
    `"statuses" jsonb NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
    `"state" character varying(16) NOT NULL DEFAULT 'draft', "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "notes" text, ` +
    `CONSTRAINT "UQ_source_status_mappings_version" UNIQUE ("tenant_id", "source_system", "version"), ` +
    `CONSTRAINT "CHK_source_status_mappings_state" CHECK ("state" IN ('draft', 'approved', 'retired')), ` +
    `CONSTRAINT "CHK_source_status_mappings_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
    `CONSTRAINT "PK_954d690256ab55e3de08ff36410" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_887fc92f512228d4860e341404" ON "source_status_mappings" ("tenant_id")`,
  `CREATE INDEX "IDX_source_status_mappings_lookup" ON "source_status_mappings" ("tenant_id", "source_system", "effective_from")`,
  `ALTER TABLE "external_production_reports" ADD "source_system" character varying(64) NOT NULL DEFAULT 'import'`,
  `ALTER TABLE "external_production_reports" ADD "status_mapping_id" uuid`,
  `ALTER TABLE "restatement_postings" ADD CONSTRAINT "FK_restatement_postings_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "restatement_postings" ADD CONSTRAINT "FK_restatement_postings_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const TABLES = ['restatement_postings', 'source_status_mappings'] as const;

const NOTE =
  'Migrated from EXTERNAL_REPORT_CERTIFIED_STATUSES (default COMPLETED, RELEASED) — the source owner confirms or replaces it (SME R13).';

/**
 * SME R5 / R13 (EXPERT_REVIEW §3.1, phase R-D): `restatement_postings` keeps finance's posting date and
 * treatment of a restated revision apart from its operational date; `source_status_mappings` holds the
 * per-source status mapping (released or not) in the database, versioned and approved; external reports
 * record the source system and the mapping version that decided their eligibility. Each existing plant
 * gets version 1 for the `import` source with the statuses the environment list used to give (the
 * variable's value at migration time, else COMPLETED, RELEASED), so nothing changes until the source owner
 * approves a new version. Both tables carry RLS `tenant_isolation`.
 */
export class RestatementPostingSourceStatus1794010200000
  implements MigrationInterface
{
  name = 'RestatementPostingSourceStatus1794010200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
    for (const table of TABLES) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }
    const statuses = (
      process.env.EXTERNAL_REPORT_CERTIFIED_STATUSES ?? 'COMPLETED,RELEASED'
    )
      .split(',')
      .map((status) => status.trim().toUpperCase())
      .filter((status) => status.length > 0)
      .map((status) => ({ status, released: true }));
    await queryRunner.query(
      `INSERT INTO "source_status_mappings" ("tenant_id", "row_version", "source_system", "version", "statuses",
              "effective_from", "state", "approved_at", "notes")
       SELECT t."id"::uuid, 1, 'import', 1, $1::jsonb, '1970-01-01T00:00:00Z', 'approved', now(), $2 FROM "tenants" t`,
      [JSON.stringify(statuses), NOTE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "external_production_reports" DROP COLUMN "status_mapping_id", DROP COLUMN "source_system"`,
    );
    await queryRunner.query(`DROP TABLE "source_status_mappings"`);
    await queryRunner.query(`DROP TABLE "restatement_postings"`);
  }
}
