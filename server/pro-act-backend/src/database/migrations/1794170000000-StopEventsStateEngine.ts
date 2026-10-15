import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

interface TableSpec {
  name: string;
  columns: string;
  constraints: string;
  /** TypeORM's name of the single-column tenant index (`TenantScopedEntity`); null = none */
  tenantIndex: string | null;
  indexes: ReadonlyArray<string>;
  foreignKeys: ReadonlyArray<string>;
}

const TABLES: readonly TableSpec[] = [
  {
    name: 'stop_reconciliations',
    columns:
      `"unit_id" uuid NOT NULL, "kept_event_id" uuid NOT NULL, "evidence_event_id" uuid NOT NULL, ` +
      `"state" character varying(16) NOT NULL, "mode" character varying(16) NOT NULL, ` +
      `"suggestion_reason" character varying(32), "start_delta_seconds" numeric(18,3) NOT NULL, ` +
      `"end_delta_seconds" numeric(18,3), "tolerance_seconds" integer NOT NULL, ` +
      `"conflicts" jsonb NOT NULL DEFAULT '[]', "copied" jsonb NOT NULL DEFAULT '{}', ` +
      `"evidence_occurrence_id" uuid, "policy_version_id" uuid, "decided_by" uuid, ` +
      `"decided_at" TIMESTAMP WITH TIME ZONE, "decision_reason" text`,
    constraints:
      `CONSTRAINT "CHK_stop_reconciliations_not_self" CHECK ("kept_event_id" <> "evidence_event_id"), ` +
      `CONSTRAINT "CHK_stop_reconciliations_mode" CHECK ("mode" IN ('auto', 'manual')), ` +
      `CONSTRAINT "CHK_stop_reconciliations_state" CHECK ("state" IN ('suggested', 'merged', 'rejected', 'undone', 'expired')), ` +
      `CONSTRAINT "PK_c0ab33cd688e85bfb68bdf05ecf" PRIMARY KEY ("id")`,
    tenantIndex: 'IDX_8458d7310a56c10ed38fd8e3ef',
    indexes: [
      `CREATE UNIQUE INDEX "UQ_stop_reconciliations_pair" ON "stop_reconciliations" ("tenant_id", "kept_event_id", "evidence_event_id")`,
      `CREATE INDEX "IDX_stop_reconciliations_tenant_unit_state" ON "stop_reconciliations" ("tenant_id", "unit_id", "state")`,
      `CREATE INDEX "IDX_stop_reconciliations_tenant_evidence" ON "stop_reconciliations" ("tenant_id", "evidence_event_id")`,
    ],
    foreignKeys: [
      `ALTER TABLE "stop_reconciliations" ADD CONSTRAINT "FK_stop_reconciliations_kept_event" FOREIGN KEY ("kept_event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      `ALTER TABLE "stop_reconciliations" ADD CONSTRAINT "FK_stop_reconciliations_evidence_event" FOREIGN KEY ("evidence_event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    ],
  },
  {
    name: 'stop_incidents',
    columns:
      `"unit_id" uuid NOT NULL, "asset_id" uuid, "reason_code_id" uuid NOT NULL, "first_occurrence_id" uuid NOT NULL, ` +
      `"start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE, ` +
      `"stop_count" integer NOT NULL, "stopped_seconds" numeric(18,3) NOT NULL, "window_seconds" integer NOT NULL, ` +
      `"policy_version_id" uuid`,
    constraints:
      `CONSTRAINT "CHK_stop_incidents_count" CHECK ("stop_count" >= 2), ` +
      `CONSTRAINT "CHK_stop_incidents_interval" CHECK ("end_time" IS NULL OR "end_time" >= "start_time"), ` +
      `CONSTRAINT "PK_a470dc2679f9fa88a838e446625" PRIMARY KEY ("id")`,
    tenantIndex: 'IDX_e9a363021da71ef233e60b1210',
    indexes: [
      `CREATE UNIQUE INDEX "UQ_stop_incidents_first_occurrence" ON "stop_incidents" ("tenant_id", "first_occurrence_id")`,
      `CREATE INDEX "IDX_stop_incidents_tenant_unit_start" ON "stop_incidents" ("tenant_id", "unit_id", "start_time")`,
    ],
    foreignKeys: [],
  },
  {
    name: 'stop_incident_members',
    columns: `"incident_id" uuid NOT NULL, "occurrence_id" uuid NOT NULL`,
    constraints: `CONSTRAINT "PK_a8b2ea20ebc85b39c137ba85e80" PRIMARY KEY ("id")`,
    tenantIndex: null,
    indexes: [
      `CREATE UNIQUE INDEX "UQ_stop_incident_members_occurrence" ON "stop_incident_members" ("tenant_id", "occurrence_id")`,
      `CREATE INDEX "IDX_stop_incident_members_incident" ON "stop_incident_members" ("incident_id")`,
    ],
    foreignKeys: [
      `ALTER TABLE "stop_incident_members" ADD CONSTRAINT "FK_stop_incident_members_incident" FOREIGN KEY ("incident_id") REFERENCES "stop_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    ],
  },
  {
    name: 'stop_incident_breaks',
    columns: `"unit_id" uuid NOT NULL, "occurrence_id" uuid NOT NULL, "reason" text NOT NULL`,
    constraints: `CONSTRAINT "PK_a8e27b39c6b76d57244f9cc2a69" PRIMARY KEY ("id")`,
    tenantIndex: 'IDX_6bf485a95f0c0c8fb72d228a7c',
    indexes: [
      `CREATE UNIQUE INDEX "UQ_stop_incident_breaks_occurrence" ON "stop_incident_breaks" ("tenant_id", "occurrence_id")`,
    ],
    foreignKeys: [],
  },
  {
    name: 'state_engine_cursors',
    columns:
      `"unit_id" uuid NOT NULL, "mapping_id" uuid NOT NULL, ` +
      `"processed_through" TIMESTAMP WITH TIME ZONE NOT NULL, "samples_seen_through" TIMESTAMP WITH TIME ZONE NOT NULL`,
    constraints: `CONSTRAINT "PK_7409fbc95f74ec50457e2d3df70" PRIMARY KEY ("id")`,
    tenantIndex: 'IDX_41de923dd1f5226edfeac125d7',
    indexes: [
      `CREATE UNIQUE INDEX "UQ_state_engine_cursors_unit" ON "state_engine_cursors" ("tenant_id", "unit_id")`,
    ],
    foreignKeys: [],
  },
];

const indexName = (statement: string) =>
  /INDEX "([^"]+)"/.exec(statement)?.[1] as string;
const constraintName = (statement: string) =>
  /CONSTRAINT "([^"]+)"/.exec(statement)?.[1] as string;

/**
 * Plan 1.10 state engine and DT-04 / SME D5 stop handling: `stop_reconciliations` (duplicate merges and
 * suggestions between manual, source and state-derived stops; reversible), `stop_incidents` +
 * `stop_incident_members` (repeat stops grouped per incident, KPI 2.7.8 counts an incident once),
 * `stop_incident_breaks` (a person's "new failure" marks) and `state_engine_cursors` (derived-stop
 * progress per unit for idempotent reprocessing of late samples). All tenant tables with RLS
 * `tenant_isolation`. Expand-only: no existing table changes.
 */
export class StopEventsStateEngine1794170000000 implements MigrationInterface {
  name = 'StopEventsStateEngine1794170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `CREATE TABLE "${table.name}" (${AUDIT}, ${table.columns}, ${table.constraints})`,
      );
      if (table.tenantIndex) {
        await queryRunner.query(
          `CREATE INDEX "${table.tenantIndex}" ON "${table.name}" ("tenant_id") `,
        );
      }
      for (const statement of table.indexes) await queryRunner.query(statement);
      for (const statement of table.foreignKeys) {
        await queryRunner.query(statement);
      }
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table.name}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table.name}" FORCE ROW LEVEL SECURITY`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `DROP POLICY tenant_isolation ON "${table.name}"`,
      );
      for (const statement of [...table.foreignKeys].reverse()) {
        await queryRunner.query(
          `ALTER TABLE "${table.name}" DROP CONSTRAINT "${constraintName(statement)}"`,
        );
      }
      for (const statement of [...table.indexes].reverse()) {
        await queryRunner.query(
          `DROP INDEX "public"."${indexName(statement)}"`,
        );
      }
      if (table.tenantIndex) {
        await queryRunner.query(`DROP INDEX "public"."${table.tenantIndex}"`);
      }
      await queryRunner.query(`DROP TABLE "${table.name}"`);
    }
  }
}
