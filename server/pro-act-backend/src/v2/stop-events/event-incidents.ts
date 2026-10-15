import { EntityManager } from 'typeorm';

const MEMBERS_SQL = `SELECT m."occurrence_id", m."incident_id" FROM "stop_incident_members" m
 WHERE m."tenant_id" = $1 AND m."occurrence_id" = ANY($2::uuid[])`;

/**
 * SME D5: incident of each listed event's occurrence (one indexed lookup per page,
 * `UQ_stop_incident_members_occurrence`); events outside an incident get null.
 */
export async function withIncidentIds<T extends { occurrenceId: string }>(
  manager: EntityManager,
  tenantId: string,
  views: readonly T[],
): Promise<Array<T & { incidentId: string | null }>> {
  const ids = [...new Set(views.map((v) => v.occurrenceId))];
  const rows =
    ids.length === 0
      ? []
      : await manager.query<
          Array<{ occurrence_id: string; incident_id: string }>
        >(MEMBERS_SQL, [tenantId, ids]);
  const byOccurrence = new Map(
    rows.map((r) => [r.occurrence_id, r.incident_id]),
  );
  return views.map((view) => ({
    ...view,
    incidentId: byOccurrence.get(view.occurrenceId) ?? null,
  }));
}
