import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'lot_dispositions';

const COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"unit_id" uuid NOT NULL, "product_id" uuid NOT NULL, "lot_code" character varying(64) NOT NULL, ` +
  `"disposition_class" character varying(32) NOT NULL, "quantity" numeric(24,8) NOT NULL, ` +
  `"uom" character varying(50) NOT NULL, "production_start" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
  `"production_end" TIMESTAMP WITH TIME ZONE NOT NULL, "lab_released_at" TIMESTAMP WITH TIME ZONE, ` +
  `"recovery_of_id" uuid, "remeasured" boolean NOT NULL DEFAULT false, "production_event_id" uuid, ` +
  `"supersedes_id" uuid, "reason" text, "evidence_ref" text, "author_id" uuid NOT NULL, ` +
  `"state" character varying(16) NOT NULL DEFAULT 'proposed', "decided_by" uuid, ` +
  `"decided_at" TIMESTAMP WITH TIME ZONE, "decision_reason" text, "superseded_at" TIMESTAMP WITH TIME ZONE`;

const CONSTRAINTS =
  `CONSTRAINT "CHK_lot_dispositions_class" CHECK ("disposition_class" IN ('wide_spec', 'downgrade', 'transition_off_grade', 'scrap', 'rework', 'recovered')), ` +
  `CONSTRAINT "CHK_lot_dispositions_state" CHECK ("state" IN ('proposed', 'approved', 'rejected', 'superseded')), ` +
  `CONSTRAINT "CHK_lot_dispositions_quantity" CHECK ("quantity" > 0), ` +
  `CONSTRAINT "CHK_lot_dispositions_interval" CHECK ("production_end" > "production_start"), ` +
  `CONSTRAINT "CHK_lot_dispositions_recovery" CHECK (("disposition_class" = 'recovered') = ("recovery_of_id" IS NOT NULL) AND ("remeasured" = false OR "disposition_class" = 'recovered')), ` +
  `CONSTRAINT "CHK_lot_dispositions_independent" CHECK ("decided_by" IS NULL OR "decided_by" <> "author_id"), ` +
  `CONSTRAINT "PK_d1e3f3f4121fb9c4b4665bef579" PRIMARY KEY ("id")`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  [
    'IDX_lot_dispositions_tenant_unit_production',
    `"${TABLE}" ("tenant_id", "unit_id", "production_start")`,
  ],
  ['IDX_lot_dispositions_tenant_lot', `"${TABLE}" ("tenant_id", "lot_code")`],
  ['IDX_lot_dispositions_unit', `"${TABLE}" ("unit_id")`],
  ['IDX_lot_dispositions_product', `"${TABLE}" ("product_id")`],
  [
    'IDX_lot_dispositions_recovery_of',
    `"${TABLE}" ("recovery_of_id") WHERE "recovery_of_id" IS NOT NULL`,
  ],
  [
    'IDX_lot_dispositions_supersedes',
    `"${TABLE}" ("supersedes_id") WHERE "supersedes_id" IS NOT NULL`,
  ],
  [
    'IDX_lot_dispositions_event',
    `"${TABLE}" ("production_event_id") WHERE "production_event_id" IS NOT NULL`,
  ],
];

const FOREIGN_KEYS: ReadonlyArray<[name: string, definition: string]> = [
  ['FK_lot_dispositions_unit', `("unit_id") REFERENCES "units"("id")`],
  ['FK_lot_dispositions_product', `("product_id") REFERENCES "products"("id")`],
  [
    'FK_lot_dispositions_recovery_of',
    `("recovery_of_id") REFERENCES "${TABLE}"("id")`,
  ],
  [
    'FK_lot_dispositions_event',
    `("production_event_id") REFERENCES "production_events"("id")`,
  ],
  [
    'FK_lot_dispositions_supersedes',
    `("supersedes_id") REFERENCES "${TABLE}"("id")`,
  ],
];

const EVENT_CHECK = [
  'CHK_production_events_disposition_class',
  `"disposition_class" IS NULL OR ("physical_type" = 'quality_loss' AND "disposition_class" IN ('downgrade', 'scrap', 'rework'))`,
] as const;

/**
 * SME E3 (good-output boundary and product disposition): `lot_dispositions` holds approved quality
 * dispositions of production lots and recovery movements (maker-checker, superseded rows kept, RLS
 * `tenant_isolation`); `production_events.disposition_class` names the disposition of a quality_loss
 * event; `actuals_results.quality_classes` stores the class breakdown of a slice (actuals 2.4.2). All new
 * columns are nullable: existing events and results are unchanged.
 */
export class LotDispositions1794040000000 implements MigrationInterface {
  name = 'LotDispositions1794040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${TABLE}" (${COLUMNS}, ${CONSTRAINTS})`,
    );
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(`CREATE INDEX "${name}" ON ${definition}`);
    }
    for (const [name, definition] of FOREIGN_KEYS) {
      await queryRunner.query(
        `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "disposition_class" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "${EVENT_CHECK[0]}" CHECK (${EVENT_CHECK[1]})`,
    );
    await queryRunner.query(
      `ALTER TABLE "actuals_results" ADD "quality_classes" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "actuals_results" DROP COLUMN "quality_classes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "${EVENT_CHECK[0]}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "disposition_class"`,
    );
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    for (const [name] of [...FOREIGN_KEYS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${name}"`,
      );
    }
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
