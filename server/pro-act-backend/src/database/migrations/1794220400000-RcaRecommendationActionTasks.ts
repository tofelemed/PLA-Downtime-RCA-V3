import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recommendation → action → task (item 5, additive): an action names the case recommendation it
 * implements (`recommendation_id`, the JSON item id) and records when its task was completed
 * (`task_completed_at`, never completing the action); a task names the action it carries out
 * (`tasks.rca_action_id`, set null when the action goes with its case), at most one open task per action.
 */
export class RcaRecommendationActionTasks1794220400000
  implements MigrationInterface
{
  name = 'RcaRecommendationActionTasks1794220400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rca_actions" ADD "recommendation_id" character varying(64), ADD "task_completed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_actions_tenant_rca_recommendation" ON "rca_actions" ("tenant_id", "rca_id", "recommendation_id")`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" ADD "rca_action_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_tenant_rca_action" ON "tasks" ("tenant_id", "rca_action_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_open_rca_action" ON "tasks" ("rca_action_id")
        WHERE "rca_action_id" IS NOT NULL AND "status" IN ('Open', 'In Progress')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_rca_action" FOREIGN KEY ("rca_action_id") REFERENCES "rca_actions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_rca_action"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_tasks_open_rca_action"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_tenant_rca_action"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "rca_action_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_rca_actions_tenant_rca_recommendation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_actions" DROP COLUMN "task_completed_at", DROP COLUMN "recommendation_id"`,
    );
  }
}
