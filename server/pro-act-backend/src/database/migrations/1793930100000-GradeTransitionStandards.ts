import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'transition_standards';

const COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"unit_id" uuid NOT NULL, "from_product_id" uuid NOT NULL, "to_product_id" uuid NOT NULL, ` +
  `"reference_seconds" numeric(14,3) NOT NULL, "reference_offgrade_qty" numeric(24,8), ` +
  `"offgrade_uom" character varying(50), "sample_count" integer, "evidence" text, "notes" text, ` +
  `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
  `"version" integer NOT NULL, "state" "public"."transition_standard_state" NOT NULL DEFAULT 'draft', ` +
  `"approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE`;

const CONSTRAINTS =
  `CONSTRAINT "UQ_transition_standards_change_version" UNIQUE ("unit_id", "from_product_id", "to_product_id", "version"), ` +
  `CONSTRAINT "CHK_transition_standards_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), ` +
  `CONSTRAINT "CHK_transition_standards_samples" CHECK ("sample_count" IS NULL OR "sample_count" > 0), ` +
  `CONSTRAINT "CHK_transition_standards_offgrade" CHECK ("reference_offgrade_qty" IS NULL OR ("reference_offgrade_qty" >= 0 AND "offgrade_uom" IS NOT NULL)), ` +
  `CONSTRAINT "CHK_transition_standards_seconds" CHECK ("reference_seconds" > 0), ` +
  `CONSTRAINT "CHK_transition_standards_products" CHECK ("from_product_id" <> "to_product_id"), ` +
  `CONSTRAINT "CHK_transition_standards_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
  `CONSTRAINT "EX_transition_standards_approved_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, "from_product_id" WITH =, ` +
  `"to_product_id" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), ` +
  `CONSTRAINT "PK_8fedcdec1899deb25c88982f711" PRIMARY KEY ("id")`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  ['IDX_7aca87f7b0403c779920474181', `"${TABLE}" ("tenant_id")`],
  ['IDX_transition_standards_tenant_unit', `"${TABLE}" ("tenant_id", "unit_id")`],
  ['IDX_transition_standards_from_product', `"${TABLE}" ("from_product_id")`],
  ['IDX_transition_standards_to_product', `"${TABLE}" ("to_product_id")`],
  [
    'IDX_production_events_from_product',
    `"production_events" ("from_product_id") WHERE "from_product_id" IS NOT NULL`,
  ],
  [
    'IDX_production_events_to_product',
    `"production_events" ("to_product_id") WHERE "to_product_id" IS NOT NULL`,
  ],
  [
    'IDX_production_events_recovery_of',
    `"production_events" ("recovery_of_event_id") WHERE "recovery_of_event_id" IS NOT NULL`,
  ],
];

const FOREIGN_KEYS: ReadonlyArray<[table: string, name: string, definition: string]> = [
  [TABLE, 'FK_transition_standards_unit', `("unit_id") REFERENCES "units"("id")`],
  [TABLE, 'FK_transition_standards_from_product', `("from_product_id") REFERENCES "products"("id")`],
  [TABLE, 'FK_transition_standards_to_product', `("to_product_id") REFERENCES "products"("id")`],
  ['production_events', 'FK_production_events_from_product', `("from_product_id") REFERENCES "products"("id")`],
  ['production_events', 'FK_production_events_to_product', `("to_product_id") REFERENCES "products"("id")`],
  [
    'production_events',
    'FK_production_events_recovery_of',
    `("recovery_of_event_id") REFERENCES "production_events"("id")`,
  ],
];

const EVENT_CHECKS: ReadonlyArray<[name: string, definition: string]> = [
  [
    'CHK_production_events_transition_products',
    `("from_product_id" IS NULL) = ("to_product_id" IS NULL) AND ("from_product_id" IS NULL OR "from_product_id" <> "to_product_id")`,
  ],
  [
    'CHK_production_events_recovery_not_self',
    `"recovery_of_event_id" IS NULL OR "recovery_of_event_id" <> "id"`,
  ],
];

/**
 * LA-08 (SME Q9 / Q10 / E1 / E3): the grade-transition matrix and the event links the accounting engine
 * needs. `transition_standards` holds approved, effective-dated reference durations (and optional
 * reference off-grade) per unit and directional product change, versioned like rates (no overlapping
 * approved versions, RLS `tenant_isolation`). `production_events` gains the from / to products of a
 * grade transition (both or neither, never equal) and `recovery_of_event_id`, the stop a ramp-up or
 * startup-quality event recovers from. All columns are nullable; existing rows are unchanged.
 */
export class GradeTransitionStandards1793930100000 implements MigrationInterface {
  name = 'GradeTransitionStandards1793930100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transition_standard_state" AS ENUM('draft', 'approved', 'retired')`,
    );
    await queryRunner.query(`CREATE TABLE "${TABLE}" (${COLUMNS}, ${CONSTRAINTS})`);
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "from_product_id" uuid, ADD "to_product_id" uuid, ADD "recovery_of_event_id" uuid`,
    );
    for (const [name, definition] of EVENT_CHECKS) {
      await queryRunner.query(
        `ALTER TABLE "production_events" ADD CONSTRAINT "${name}" CHECK (${definition})`,
      );
    }
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(`CREATE INDEX "${name}" ON ${definition}`);
    }
    for (const [table, name, definition] of FOREIGN_KEYS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    for (const [table, name] of [...FOREIGN_KEYS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    }
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    for (const [name] of [...EVENT_CHECKS].reverse()) {
      await queryRunner.query(`ALTER TABLE "production_events" DROP CONSTRAINT "${name}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "recovery_of_event_id", DROP COLUMN "to_product_id", DROP COLUMN "from_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
    await queryRunner.query(`DROP TYPE "public"."transition_standard_state"`);
  }
}
