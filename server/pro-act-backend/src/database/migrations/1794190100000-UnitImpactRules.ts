import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const RULES =
  `CREATE TABLE "unit_impact_rules" (${AUDIT}, "unit_id" uuid NOT NULL, "asset_id" uuid NOT NULL, ` +
  `"mode" character varying(16) NOT NULL, "fraction" numeric(9,8), "standby_asset_id" uuid, ` +
  `"takeover_seconds" integer NOT NULL DEFAULT 60, "reason" text NOT NULL, ` +
  `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, ` +
  `"version" integer NOT NULL, "state" "public"."unit_impact_rule_state" NOT NULL DEFAULT 'draft', ` +
  `"approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, ` +
  `CONSTRAINT "UQ_unit_impact_rules_version" UNIQUE ("unit_id", "asset_id", "version"), ` +
  `CONSTRAINT "CHK_unit_impact_rules_mode" CHECK ("mode" IN ('full_stop', 'fractional', 'none')), ` +
  `CONSTRAINT "CHK_unit_impact_rules_fraction" CHECK (("mode" = 'fractional') = ("fraction" IS NOT NULL) ` +
  `AND ("fraction" IS NULL OR ("fraction" > 0 AND "fraction" <= 1))), ` +
  `CONSTRAINT "CHK_unit_impact_rules_standby" CHECK ("standby_asset_id" IS NULL OR "standby_asset_id" <> "asset_id"), ` +
  `CONSTRAINT "CHK_unit_impact_rules_takeover" CHECK ("takeover_seconds" >= 0), ` +
  `CONSTRAINT "CHK_unit_impact_rules_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
  `CONSTRAINT "CHK_unit_impact_rules_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), ` +
  `CONSTRAINT "EX_unit_impact_rules_approved_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, "asset_id" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), ` +
  `CONSTRAINT "PK_2a0a192d1081a24e1e600f99f19" PRIMARY KEY ("id"))`;

const IMPACTS =
  `CREATE TABLE "event_impacts" (${AUDIT}, "event_id" uuid NOT NULL, "unit_id" uuid NOT NULL, ` +
  `"asset_id" uuid NOT NULL, "mode" character varying(16) NOT NULL, "fraction" numeric(9,8), ` +
  `"basis" character varying(24) NOT NULL, "rule_id" uuid, "rule_version" integer, "standby_record_id" uuid, ` +
  `"resolved_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
  `CONSTRAINT "CHK_event_impacts_basis" CHECK ("basis" IN ('default', 'stated', 'unit_rule', 'standby_takeover')), ` +
  `CONSTRAINT "PK_9a724f3320514ee621b09fd6932" PRIMARY KEY ("id"))`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  ['IDX_c031a85158e72fbab7deccbd1c', `"unit_impact_rules" ("tenant_id")`],
  [
    'IDX_unit_impact_rules_tenant_unit_asset',
    `"unit_impact_rules" ("tenant_id", "unit_id", "asset_id")`,
  ],
  [
    'IDX_unit_impact_rules_standby',
    `"unit_impact_rules" ("standby_asset_id") WHERE "standby_asset_id" IS NOT NULL`,
  ],
  ['UQ_event_impacts_event', `"event_impacts" ("event_id")`],
  ['IDX_event_impacts_tenant_rule', `"event_impacts" ("tenant_id", "rule_id")`],
];

const FOREIGN_KEYS: ReadonlyArray<
  [table: string, name: string, definition: string]
> = [
  [
    'unit_impact_rules',
    'FK_unit_impact_rules_unit',
    `("unit_id") REFERENCES "units"("id")`,
  ],
  [
    'unit_impact_rules',
    'FK_unit_impact_rules_asset',
    `("asset_id") REFERENCES "assets"("id")`,
  ],
  [
    'unit_impact_rules',
    'FK_unit_impact_rules_standby_asset',
    `("standby_asset_id") REFERENCES "assets"("id")`,
  ],
  [
    'event_impacts',
    'FK_event_impacts_event',
    `("event_id") REFERENCES "production_events"("id")`,
  ],
  [
    'event_impacts',
    'FK_event_impacts_rule',
    `("rule_id") REFERENCES "unit_impact_rules"("id")`,
  ],
];

const TABLES = ['unit_impact_rules', 'event_impacts'] as const;
const BASIS_CHECK = 'CHK_production_events_impact_basis';

/**
 * Plan 1.10 step 4 (SME Q5 + D9): `unit_impact_rules` — effective-dated, maker-checker master data saying
 * how a stop of one asset affects its unit (full stop, a fraction of the rate, none) and which installed
 * standby holds the output when it starts in time; `event_impacts` — the impact derived for each equipment
 * stop with its evidence; `production_events.impact_basis` — whether the event's impact was stated (the
 * manual override, never replaced) or derived. Existing events keep their impact (`default`; a stored
 * impact other than `full_stop` counts as stated). Adding a column with a constant default is metadata only.
 */
export class UnitImpactRules1794190100000 implements MigrationInterface {
  name = 'UnitImpactRules1794190100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."unit_impact_rule_state" AS ENUM('draft', 'approved', 'retired')`,
    );
    await queryRunner.query(RULES);
    await queryRunner.query(IMPACTS);
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
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "impact_basis" character varying(24) NOT NULL DEFAULT 'default'`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "${BASIS_CHECK}" ` +
        `CHECK ("impact_basis" IN ('default', 'stated', 'unit_rule', 'standby_takeover'))`,
    );
  }

  /** Derived impacts stay on their events as stored values; only the rules and the evidence go. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "${BASIS_CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "impact_basis"`,
    );
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
    await queryRunner.query(`DROP TABLE "event_impacts"`);
    await queryRunner.query(`DROP TABLE "unit_impact_rules"`);
    await queryRunner.query(`DROP TYPE "public"."unit_impact_rule_state"`);
  }
}
