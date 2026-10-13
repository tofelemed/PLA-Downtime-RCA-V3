import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB-03 (EXPERT_REVIEW, 13 Oct 2026): an event's revisions, coding, review items and relations restrict
 * its deletion instead of cascading with it — events are retracted (tombstones), never deleted, so the
 * history that approved ledgers point at stays reproducible. The v1 DELETE retracts since the same change.
 */
export class EventHistoryRestrict1793907000000 implements MigrationInterface {
  name = 'EventHistoryRestrict1793907000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_review_items" DROP CONSTRAINT "FK_25ab6786605a498c12d34c3c1a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "FK_ef1cf2a6fc0eacbb8ed0fe58495"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" DROP CONSTRAINT "FK_1161551aeffa4ecaef63adc7d8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" DROP CONSTRAINT "FK_6243ca3de560c4a3f4af22de725"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_revisions" DROP CONSTRAINT "FK_cff28cc6154ae420bce7414eb21"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_review_items" ADD CONSTRAINT "FK_25ab6786605a498c12d34c3c1a9" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "FK_ef1cf2a6fc0eacbb8ed0fe58495" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" ADD CONSTRAINT "FK_1161551aeffa4ecaef63adc7d8c" FOREIGN KEY ("from_event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" ADD CONSTRAINT "FK_6243ca3de560c4a3f4af22de725" FOREIGN KEY ("to_event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_revisions" ADD CONSTRAINT "FK_cff28cc6154ae420bce7414eb21" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_revisions" DROP CONSTRAINT "FK_cff28cc6154ae420bce7414eb21"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" DROP CONSTRAINT "FK_6243ca3de560c4a3f4af22de725"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" DROP CONSTRAINT "FK_1161551aeffa4ecaef63adc7d8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "FK_ef1cf2a6fc0eacbb8ed0fe58495"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_review_items" DROP CONSTRAINT "FK_25ab6786605a498c12d34c3c1a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_revisions" ADD CONSTRAINT "FK_cff28cc6154ae420bce7414eb21" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" ADD CONSTRAINT "FK_6243ca3de560c4a3f4af22de725" FOREIGN KEY ("to_event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_relations" ADD CONSTRAINT "FK_1161551aeffa4ecaef63adc7d8c" FOREIGN KEY ("from_event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "FK_ef1cf2a6fc0eacbb8ed0fe58495" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_review_items" ADD CONSTRAINT "FK_25ab6786605a498c12d34c3c1a9" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
