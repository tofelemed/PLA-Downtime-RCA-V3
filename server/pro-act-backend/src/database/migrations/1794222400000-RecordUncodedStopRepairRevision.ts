import { MigrationInterface, QueryRunner } from 'typeorm';

const REASON = 'Repair: reasonless stop marked uncoded';

/**
 * Audit trail of the R1 data repair (owner finding O1, DECISIONS 2026-10-19). `UncodeReasonlessCodedStops`
 * set `coding_state = 'uncoded'` (status "Open") on downtime events without a reason, but wrote no revision,
 * so the latest revision's effective snapshot still says "coded" / "Coded" while the event row says
 * uncoded. Revisions are append-only history, so instead of editing them this appends one `system` revision
 * per such event (actor System, reason "Repair: reasonless stop marked uncoded") whose snapshot is the latest
 * one with the row's coding state and status — the latest revision matches the row again. Idempotent (an
 * event whose latest revision already says uncoded is skipped). `down` removes exactly these revisions while
 * they are still the latest of their event.
 */
export class RecordUncodedStopRepairRevision1794222400000
  implements MigrationInterface
{
  name = 'RecordUncodedStopRepairRevision1794222400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "event_revisions" ("tenant_id", "row_version", "event_id", "revision", "kind", "source_facts",
              "effective_facts", "change_reason", "actor_id", "actor_kind", "source_revision")
       SELECT e."tenant_id", 1, e."id", latest."revision" + 1, 'system', NULL,
              latest."effective_facts"
                || jsonb_build_object('codingState', e."coding_state"::text, 'status', e."status"),
              $1, NULL, 'system', NULL
         FROM "production_events" e
         JOIN LATERAL (SELECT r."revision", r."effective_facts" FROM "event_revisions" r
                        WHERE r."event_id" = e."id"
                        ORDER BY r."revision" DESC LIMIT 1) latest ON true
        WHERE e."tenant_id" IS NOT NULL
          AND e."physical_type" = 'downtime'
          AND e."reason_code_id" IS NULL
          AND e."coding_state" = 'uncoded'
          AND latest."effective_facts"->>'codingState' = 'coded'
          AND latest."effective_facts"->>'reasonCodeId' IS NULL`,
      [REASON],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "event_revisions" r
        WHERE r."change_reason" = $1 AND r."kind" = 'system' AND r."actor_kind" = 'system'
          AND NOT EXISTS (SELECT 1 FROM "event_revisions" later
                           WHERE later."event_id" = r."event_id" AND later."revision" > r."revision")`,
      [REASON],
    );
  }
}
