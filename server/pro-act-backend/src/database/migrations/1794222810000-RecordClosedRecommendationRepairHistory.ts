import { MigrationInterface, QueryRunner } from 'typeorm';
import { recordCaseRepair, removeCaseRepair } from '../case-repair-history';

const REPAIR = {
  name: 'CloseRecommendationsOfClosedCases1794221700000',
  reason:
    'Data repair: the recommendations of this closed investigation were set to Completed or Cancelled from ' +
    'the statuses of their actions (closure rule applied to investigations closed before it existed)',
  changedFields: ['recommendations'],
} as const;

/**
 * History of the 2026-10-18 18:47Z data repair (QA audit M1, DECISIONS 2026-10-19 "Closed records are
 * frozen … data repairs are recorded in the record's history"). `CloseRecommendationsOfClosedCases` changed
 * the recommendations of closed investigations and moved their row version without an audit row, so the
 * History ended at the closure while the case had changed after it. This appends one "Data repair" entry
 * (actor System) to each closed investigation that repair wrote: a closed case with a final recommendation
 * whose row version is newer than its last History entry of the case row. Idempotent; `down` removes
 * exactly these entries.
 */
export class RecordClosedRecommendationRepairHistory1794222810000
  implements MigrationInterface
{
  name = 'RecordClosedRecommendationRepairHistory1794222810000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await recordCaseRepair(
      queryRunner,
      REPAIR,
      `r."status" = 'Closed'
        AND r."recommendations" ~ '"status":"(Completed|Cancelled)"'
        AND r."row_version" > (SELECT max(a."revision") FROM "audit_log" a
                                WHERE a."tenant_id" = r."tenant_id" AND a."entity_type" = 'rca_case'
                                  AND a."entity_id" = r."id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await removeCaseRepair(queryRunner, REPAIR.name);
  }
}
