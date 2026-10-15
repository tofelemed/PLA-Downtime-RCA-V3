import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'transition_standards';
const CATALYST = `COALESCE("catalyst_family", '')`;
const MODE = `COALESCE("operating_mode", '')`;

const OLD_EXCLUSION =
  `EXCLUDE USING gist ("unit_id" WITH =, "from_product_id" WITH =, "to_product_id" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

const NEW_EXCLUSION =
  `EXCLUDE USING gist ("unit_id" WITH =, "from_product_id" WITH =, "to_product_id" WITH =, ` +
  `(${CATALYST}) WITH =, (${MODE}) WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

const CONTEXT_CHECK = `("catalyst_family" IS NULL OR "catalyst_family" <> '') AND ("operating_mode" IS NULL OR "operating_mode" <> '')`;

/**
 * SME E1: the grade-transition standard key becomes unit × from × to × catalyst family × operating mode.
 * Both new columns are nullable on `transition_standards` (null = "any"; the most specific approved match
 * wins in the engine) and on `production_events` (the context a grade transition records). Versions and
 * the no-overlap rule now hold per full key (blank parts are refused, so COALESCE to '' cannot collide
 * with a real value). Existing rows keep null context and match exactly as before.
 * `down` restores the three-part key; it fails while two approved rows differ only by context.
 */
export class TransitionStandardContext1794160000000
  implements MigrationInterface
{
  name = 'TransitionStandardContext1794160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD "catalyst_family" character varying(64), ADD "operating_mode" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "CHK_transition_standards_context" CHECK (${CONTEXT_CHECK})`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "UQ_transition_standards_change_version"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_transition_standards_key_version" ON "${TABLE}" ` +
        `("unit_id", "from_product_id", "to_product_id", (${CATALYST}), (${MODE}), "version")`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "EX_transition_standards_approved_no_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "EX_transition_standards_approved_no_overlap" ${NEW_EXCLUSION}`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "catalyst_family" character varying(64), ADD "operating_mode" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "operating_mode", DROP COLUMN "catalyst_family"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "EX_transition_standards_approved_no_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "EX_transition_standards_approved_no_overlap" ${OLD_EXCLUSION}`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_transition_standards_key_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "UQ_transition_standards_change_version" UNIQUE ("unit_id", "from_product_id", "to_product_id", "version")`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "CHK_transition_standards_context"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP COLUMN "operating_mode", DROP COLUMN "catalyst_family"`,
    );
  }
}
