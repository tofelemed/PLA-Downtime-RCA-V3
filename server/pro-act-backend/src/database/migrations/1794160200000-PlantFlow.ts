import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const ROUTE_COLUMNS =
  `${AUDIT}, "from_unit_id" uuid NOT NULL, "to_unit_id" uuid NOT NULL, ` +
  `"route_role" character varying(16) NOT NULL DEFAULT 'feed', "yield_factor" numeric(12,8) NOT NULL DEFAULT 1, ` +
  `"buffer_name" character varying(255), "usable_inventory" numeric(24,8), "min_operating_level" numeric(24,8), ` +
  `"max_operating_level" numeric(24,8), "inventory_uom" character varying(50), "draw_rate_per_hour" numeric(24,8), ` +
  `"notes" text, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
  `"version" integer NOT NULL, "state" "public"."plant_flow_route_state" NOT NULL DEFAULT 'draft', ` +
  `"approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE`;

const ROUTE_CONSTRAINTS =
  `CONSTRAINT "UQ_plant_flow_routes_version" UNIQUE ("from_unit_id", "to_unit_id", "version"), ` +
  `CONSTRAINT "CHK_plant_flow_routes_units" CHECK ("from_unit_id" <> "to_unit_id"), ` +
  `CONSTRAINT "CHK_plant_flow_routes_role" CHECK ("route_role" IN ('feed', 'alternate')), ` +
  `CONSTRAINT "CHK_plant_flow_routes_yield" CHECK ("yield_factor" > 0), ` +
  `CONSTRAINT "CHK_plant_flow_routes_buffer" CHECK ((("usable_inventory" IS NULL AND "max_operating_level" IS NULL) ` +
  `OR ("inventory_uom" IS NOT NULL AND "draw_rate_per_hour" IS NOT NULL)) AND ("usable_inventory" IS NULL OR "usable_inventory" >= 0) ` +
  `AND ("draw_rate_per_hour" IS NULL OR "draw_rate_per_hour" > 0)), ` +
  `CONSTRAINT "CHK_plant_flow_routes_limits" CHECK ("min_operating_level" IS NULL OR "max_operating_level" IS NULL ` +
  `OR "max_operating_level" > "min_operating_level"), ` +
  `CONSTRAINT "CHK_plant_flow_routes_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
  `CONSTRAINT "CHK_plant_flow_routes_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), ` +
  `CONSTRAINT "EX_plant_flow_routes_approved_no_overlap" EXCLUDE USING gist ("from_unit_id" WITH =, "to_unit_id" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), ` +
  `CONSTRAINT "PK_c70f555c6ef5ffb14b38c995e21" PRIMARY KEY ("id")`;

const LEVEL_COLUMNS =
  `${AUDIT}, "from_unit_id" uuid NOT NULL, "to_unit_id" uuid NOT NULL, ` +
  `"observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "level" numeric(24,8) NOT NULL, "uom" character varying(50) NOT NULL, ` +
  `"source" character varying(16) NOT NULL DEFAULT 'manual', "notes" text`;

const LEVEL_CONSTRAINTS =
  `CONSTRAINT "UQ_buffer_levels_reading" UNIQUE ("tenant_id", "from_unit_id", "to_unit_id", "observed_at"), ` +
  `CONSTRAINT "CHK_buffer_levels_level" CHECK ("level" >= 0), ` +
  `CONSTRAINT "CHK_buffer_levels_source" CHECK ("source" IN ('manual', 'signal', 'import')), ` +
  `CONSTRAINT "PK_30968fb597a4b4d698656b5c7b7" PRIMARY KEY ("id")`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  ['IDX_1d6559ddce3efa137676bc9c63', `"plant_flow_routes" ("tenant_id")`],
  [
    'IDX_plant_flow_routes_tenant_to',
    `"plant_flow_routes" ("tenant_id", "to_unit_id")`,
  ],
  [
    'IDX_plant_flow_routes_tenant_from',
    `"plant_flow_routes" ("tenant_id", "from_unit_id")`,
  ],
  ['IDX_ab7af7a9db037b87a30ad8cbc7', `"buffer_levels" ("tenant_id")`],
  [
    'IDX_buffer_levels_tenant_to_observed',
    `"buffer_levels" ("tenant_id", "to_unit_id", "observed_at")`,
  ],
  ['IDX_buffer_levels_from_unit', `"buffer_levels" ("from_unit_id")`],
  ['IDX_buffer_levels_to_unit', `"buffer_levels" ("to_unit_id")`],
];

const FOREIGN_KEYS: ReadonlyArray<
  [table: string, name: string, definition: string]
> = [
  [
    'plant_flow_routes',
    'FK_plant_flow_routes_from_unit',
    `("from_unit_id") REFERENCES "units"("id")`,
  ],
  [
    'plant_flow_routes',
    'FK_plant_flow_routes_to_unit',
    `("to_unit_id") REFERENCES "units"("id")`,
  ],
  [
    'buffer_levels',
    'FK_buffer_levels_from_unit',
    `("from_unit_id") REFERENCES "units"("id")`,
  ],
  [
    'buffer_levels',
    'FK_buffer_levels_to_unit',
    `("to_unit_id") REFERENCES "units"("id")`,
  ],
];

const TABLES = ['plant_flow_routes', 'buffer_levels'] as const;

/**
 * SME E2: the plant's directed material-flow map. `plant_flow_routes` is effective-dated master data
 * (maker-checker versions per from → to unit, no overlapping approved version): route role (feed /
 * alternate), conversion yield, the buffer between the units (usable inventory, operating limits, unit)
 * and the downstream draw rate that turns inventory into hours of cover. `buffer_levels` holds recorded
 * buffer (silo) levels, preferred over the configured inventory when recent. Nothing changes for units
 * without routes.
 */
export class PlantFlow1794160200000 implements MigrationInterface {
  name = 'PlantFlow1794160200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."plant_flow_route_state" AS ENUM('draft', 'approved', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "plant_flow_routes" (${ROUTE_COLUMNS}, ${ROUTE_CONSTRAINTS})`,
    );
    await queryRunner.query(
      `CREATE TABLE "buffer_levels" (${LEVEL_COLUMNS}, ${LEVEL_CONSTRAINTS})`,
    );
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(`CREATE INDEX "${name}" ON ${definition}`);
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
    await queryRunner.query(`DROP TABLE "buffer_levels"`);
    await queryRunner.query(`DROP TABLE "plant_flow_routes"`);
    await queryRunner.query(`DROP TYPE "public"."plant_flow_route_state"`);
  }
}
