import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const NOTES =
  `CREATE TABLE "shift_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"unit_id" uuid NOT NULL, "local_date" date NOT NULL, "shift_name" character varying(64) NOT NULL, ` +
  `"body" text NOT NULL, ` +
  `CONSTRAINT "CHK_shift_notes_body" CHECK (length("body") BETWEEN 1 AND 2000), ` +
  `CONSTRAINT "PK_975613d39b81dfc86921df8bc70" PRIMARY KEY ("id"))`;

/**
 * Shift handover notes (report R2, `plans/REPORTS_R1_R12.md`): free text the outgoing shift leaves for the
 * next one, per unit, plant date and shift label. Append-only (a correction is a new note); a unit with
 * notes is never deleted (RESTRICT). Read by unit, date and shift.
 */
export class ShiftNotes1794240800000 implements MigrationInterface {
  name = 'ShiftNotes1794240800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(NOTES);
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_notes_tenant_unit_shift" ON "shift_notes" ("tenant_id", "unit_id", "local_date", "shift_name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_notes" ADD CONSTRAINT "FK_shift_notes_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "shift_notes" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_notes" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_notes" FORCE ROW LEVEL SECURITY`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "shift_notes"`);
    await queryRunner.query(
      `ALTER TABLE "shift_notes" DROP CONSTRAINT "FK_shift_notes_unit"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_shift_notes_tenant_unit_shift"`);
    await queryRunner.query(`DROP TABLE "shift_notes"`);
  }
}
