import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data repair (Marun regression R1, DECISIONS 2026-10-18): before the coding state was recomputed on every
 * write, clearing a stop's reason left `coding_state = 'coded'` (status "Coded"), so the uncoded reminder,
 * the uncoded index and the Event Hub coding filter missed the stop. Downtime events with no reason, not
 * under investigation and still `coded` become `uncoded`; their supervisor verification is cleared (nothing
 * coded is left to confirm) and the legacy status "Coded" becomes "Open" (an RCA or retraction label stays).
 * `row_version` moves so open editors reload. Idempotent. `down` is a no-op: the wrong state is not worth
 * restoring and which rows held it is not recorded.
 */
export class UncodeReasonlessCodedStops1794221600000
  implements MigrationInterface
{
  name = 'UncodeReasonlessCodedStops1794221600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "production_events"
          SET "coding_state" = 'uncoded',
              "status" = CASE WHEN "status" = 'Coded' THEN 'Open' ELSE "status" END,
              "verified_by" = NULL,
              "verified_at" = NULL,
              "row_version" = "row_version" + 1
        WHERE "physical_type" = 'downtime'
          AND "reason_code_id" IS NULL
          AND "investigation_pending" = false
          AND "coding_state" = 'coded'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
