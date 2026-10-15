import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'uncertainty_budgets';

const COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"unit_id" uuid NOT NULL, "boundary" character varying(64) NOT NULL, "uom" character varying(50) NOT NULL, ` +
  `"components" jsonb NOT NULL, "correlations" jsonb NOT NULL DEFAULT '[]', ` +
  `"coverage_factor" numeric(6,3) NOT NULL, "combined_standard_uncertainty" numeric(24,8) NOT NULL, ` +
  `"expanded_uncertainty" numeric(24,8) NOT NULL, "calibration_ref" text NOT NULL, ` +
  `"review_due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "evidence_ref" text, "notes" text, ` +
  `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
  `"author_id" uuid NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'proposed', "decided_by" uuid, ` +
  `"decided_at" TIMESTAMP WITH TIME ZONE, "decision_reason" text`;

const CONSTRAINTS =
  `CONSTRAINT "CHK_uncertainty_budgets_state" CHECK ("state" IN ('proposed', 'approved', 'rejected')), ` +
  `CONSTRAINT "CHK_uncertainty_budgets_values" CHECK ("coverage_factor" > 0 AND "combined_standard_uncertainty" >= 0 AND "expanded_uncertainty" >= 0), ` +
  `CONSTRAINT "CHK_uncertainty_budgets_interval" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
  `CONSTRAINT "CHK_uncertainty_budgets_independent" CHECK ("decided_by" IS NULL OR "decided_by" <> "author_id"), ` +
  `CONSTRAINT "PK_6bdfc74540088790b4b5006e43b" PRIMARY KEY ("id")`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  [
    'IDX_uncertainty_budgets_tenant_unit_boundary',
    `"${TABLE}" ("tenant_id", "unit_id", "boundary", "effective_from")`,
  ],
  ['IDX_uncertainty_budgets_unit', `"${TABLE}" ("unit_id")`],
];

const OPEN_INDEX =
  `CREATE UNIQUE INDEX "UQ_uncertainty_budgets_open" ON "${TABLE}" ("tenant_id", "unit_id", "boundary") ` +
  `WHERE "state" = 'approved' AND "effective_to" IS NULL`;

/**
 * SME E4 and E7 (actuals 2.4.3): `uncertainty_budgets` holds the effective-dated uncertainty budget of a
 * unit's measurement boundary (components, correlations, coverage factor, the server-computed combined
 * and expanded uncertainty, calibration evidence and review date; maker-checker; at most one approved
 * open-ended budget per unit and boundary; RLS `tenant_isolation`). `actuals_results.substitution` stores
 * the E7 substitution flag of a slice. The new column is nullable: existing results are unchanged.
 */
export class MeasurementSourcesUncertainty1794120000000
  implements MigrationInterface
{
  name = 'MeasurementSourcesUncertainty1794120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${TABLE}" (${COLUMNS}, ${CONSTRAINTS})`,
    );
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(`CREATE INDEX "${name}" ON ${definition}`);
    }
    await queryRunner.query(OPEN_INDEX);
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_uncertainty_budgets_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `ALTER TABLE "actuals_results" ADD "substitution" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "actuals_results" DROP COLUMN "substitution"`,
    );
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "FK_uncertainty_budgets_unit"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_uncertainty_budgets_open"`,
    );
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
