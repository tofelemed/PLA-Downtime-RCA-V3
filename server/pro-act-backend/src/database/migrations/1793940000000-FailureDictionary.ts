import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'failure_dictionary_entries';

/**
 * SME D11 (EXPERT_REVIEW §2.1): the plant's ISO 14224-aligned failure dictionary — equipment classes, their
 * maintainable items and failure modes, and the plant-wide mechanism, cause and detection-method lists,
 * each entry effective-dated with an optional "pending" flag. One open entry per kind + class + code.
 * Event failure fields are checked against it once a kind has entries (free text before). RLS
 * `tenant_isolation` (DB-04 form).
 */
export class FailureDictionary1793940000000 implements MigrationInterface {
  name = 'FailureDictionary1793940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "entry_kind" character varying(32) NOT NULL, "equipment_class" character varying(50) NOT NULL DEFAULT '', "code" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "category" character varying(100), "asset_types" jsonb NOT NULL DEFAULT '[]', "is_pending" boolean NOT NULL DEFAULT false, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_failure_dictionary_entries_class" CHECK ("equipment_class" = '' OR "entry_kind" IN ('maintainable_item', 'failure_mode')), CONSTRAINT "CHK_failure_dictionary_entries_kind" CHECK ("entry_kind" IN ('equipment_class', 'maintainable_item', 'failure_mode', 'failure_mechanism', 'failure_cause', 'detection_method')), CONSTRAINT "CHK_failure_dictionary_entries_interval" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "PK_c448a871a0e5d0c8d6baa8b05b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd1145cff62fe67d6f7302d884" ON "${TABLE}" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_failure_dictionary_entries_tenant_kind" ON "${TABLE}" ("tenant_id", "entry_kind", "effective_from") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_failure_dictionary_entries_current" ON "${TABLE}" ("tenant_id", "entry_kind", "equipment_class", "code") WHERE "effective_to" IS NULL`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_failure_dictionary_entries_current"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_failure_dictionary_entries_tenant_kind"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd1145cff62fe67d6f7302d884"`,
    );
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
