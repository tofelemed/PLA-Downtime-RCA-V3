import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const STREAM_COLUMNS =
  `${AUDIT}, "unit_id" uuid NOT NULL, "code" character varying(64) NOT NULL, "name" character varying(255) NOT NULL, ` +
  `"capacity_share" numeric(9,8) NOT NULL, "notes" text, ` +
  `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
  `"version" integer NOT NULL, "state" "public"."unit_stream_state" NOT NULL DEFAULT 'draft', ` +
  `"approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE`;

const STREAM_CONSTRAINTS =
  `CONSTRAINT "UQ_unit_streams_code_version" UNIQUE ("unit_id", "code", "version"), ` +
  `CONSTRAINT "CHK_unit_streams_share" CHECK ("capacity_share" > 0 AND "capacity_share" <= 1), ` +
  `CONSTRAINT "CHK_unit_streams_code" CHECK ("code" <> ''), ` +
  `CONSTRAINT "CHK_unit_streams_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
  `CONSTRAINT "CHK_unit_streams_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), ` +
  `CONSTRAINT "EX_unit_streams_approved_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, "code" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), ` +
  `CONSTRAINT "PK_61b4c7198cf7b89aab95b9346f2" PRIMARY KEY ("id")`;

const RUN_COLUMNS =
  `${AUDIT}, "unit_id" uuid NOT NULL, "stream_code" character varying(64) NOT NULL, "product_id" uuid NOT NULL, ` +
  `"lot_code" character varying(64), "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
  `"end_time" TIMESTAMP WITH TIME ZONE, "notes" text`;

const RUN_CONSTRAINTS =
  `CONSTRAINT "CHK_stream_runs_interval" CHECK ("end_time" IS NULL OR "end_time" > "start_time"), ` +
  `CONSTRAINT "CHK_stream_runs_lot" CHECK ("lot_code" IS NULL OR "lot_code" <> ''), ` +
  `CONSTRAINT "EX_stream_runs_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, "stream_code" WITH =, ` +
  `tstzrange("start_time", "end_time", '[)') WITH &&), ` +
  `CONSTRAINT "PK_0b2daa88d6e68084f021db44ccb" PRIMARY KEY ("id")`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  ['IDX_ab248cb66cf01a2254f835aaf3', `"unit_streams" ("tenant_id")`],
  ['IDX_unit_streams_tenant_unit', `"unit_streams" ("tenant_id", "unit_id")`],
  ['IDX_7b4828e54cf099626221a42c90', `"stream_runs" ("tenant_id")`],
  [
    'IDX_stream_runs_tenant_unit_start',
    `"stream_runs" ("tenant_id", "unit_id", "start_time")`,
  ],
  ['IDX_stream_runs_product', `"stream_runs" ("product_id")`],
  [
    'UQ_stream_runs_lot',
    `"stream_runs" ("tenant_id", "lot_code") WHERE "lot_code" IS NOT NULL`,
  ],
  [
    'IDX_production_events_lot',
    `"production_events" ("tenant_id", "lot_code") WHERE "lot_code" IS NOT NULL`,
  ],
];

const FOREIGN_KEYS: ReadonlyArray<
  [table: string, name: string, definition: string]
> = [
  [
    'unit_streams',
    'FK_unit_streams_unit',
    `("unit_id") REFERENCES "units"("id")`,
  ],
  [
    'stream_runs',
    'FK_stream_runs_unit',
    `("unit_id") REFERENCES "units"("id")`,
  ],
  [
    'stream_runs',
    'FK_stream_runs_product',
    `("product_id") REFERENCES "products"("id")`,
  ],
];

const TABLES = ['unit_streams', 'stream_runs'] as const;

/**
 * SME E6 / LA-10: streams (parallel trains or lines) of a unit and the product each runs over time.
 * `unit_streams` is effective-dated master data (maker-checker versions per unit and code, no overlapping
 * approved version) with the share of the unit's rate the stream provides; `stream_runs` records which
 * product a stream ran over `[start, end)` and the production lot made on that run (lot codes unique per
 * tenant; runs of one stream never overlap). `production_events` gains `stream_code` (the stream an event
 * happened on; null = the whole unit) and `lot_code` (the lot an output measurement belongs to — silo or
 * packaging output keeps the grade it was made as). Nothing changes for units without streams.
 */
export class UnitStreams1794160100000 implements MigrationInterface {
  name = 'UnitStreams1794160100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."unit_stream_state" AS ENUM('draft', 'approved', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "unit_streams" (${STREAM_COLUMNS}, ${STREAM_CONSTRAINTS})`,
    );
    await queryRunner.query(
      `CREATE TABLE "stream_runs" (${RUN_COLUMNS}, ${RUN_CONSTRAINTS})`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "stream_code" character varying(64), ADD "lot_code" character varying(64)`,
    );
    for (const [name, definition] of INDEXES) {
      const unique = name.startsWith('UQ_') ? 'UNIQUE ' : '';
      await queryRunner.query(
        `CREATE ${unique}INDEX "${name}" ON ${definition}`,
      );
    }
    for (const [table, name, definition] of FOREIGN_KEYS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    for (const [table, name] of [...FOREIGN_KEYS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`,
      );
    }
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "lot_code", DROP COLUMN "stream_code"`,
    );
    await queryRunner.query(`DROP TABLE "stream_runs"`);
    await queryRunner.query(`DROP TABLE "unit_streams"`);
    await queryRunner.query(`DROP TYPE "public"."unit_stream_state"`);
  }
}
