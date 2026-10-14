import { UnprocessableEntityException } from '@nestjs/common';
import {
  START_STATUSES,
  statusOf,
  TEAM_LOCKED_STATUSES,
} from '../domain/rca/case-workflow';
import { readIds } from '../rca-case/rca-case-json';
import { RCA } from './rca.entity';

function refused(code: string, field: string, message: string) {
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

const sameIds = (stored: unknown, next: readonly string[]): boolean => {
  const current = readIds(stored);
  return (
    current.length === next.length && next.every((id) => current.includes(id))
  );
};

/** RCA-01 on the v1 routes: a case opens as Draft or In Progress (later statuses are transitions). */
export function assertV1CreateStatus(status: string | undefined): void {
  if (
    status === undefined ||
    (START_STATUSES as readonly string[]).includes(status)
  )
    return;
  throw refused(
    'INVALID_STATUS',
    'status',
    'a case opens as Draft or In Progress; later statuses go through POST /api/v2/rcas/{id}/transitions',
  );
}

/**
 * RCA-01 / CA1 on the v1 routes: the status never changes by an edit (only the v2 workflow moves it), and
 * the team is fixed once the investigation is accepted — so a v1 PUT cannot close a case or bypass the
 * independent closure approval.
 */
export function assertV1Update(
  stored: RCA,
  data: { status?: string; teamLeadId?: string; teamMemberIds?: string[] },
): void {
  if (data.status !== undefined && data.status !== statusOf(stored.status)) {
    throw refused(
      'STATUS_VIA_TRANSITION',
      'status',
      'the status changes through POST /api/v2/rcas/{id}/transitions (the case workflow), not by an edit',
    );
  }
  if (!TEAM_LOCKED_STATUSES.includes(statusOf(stored.status))) return;
  const leadChanged =
    data.teamLeadId !== undefined &&
    data.teamLeadId !== (stored.teamLeadId ?? null);
  const membersChanged =
    data.teamMemberIds !== undefined &&
    !sameIds(stored.teamMemberIds, data.teamMemberIds);
  if (!leadChanged && !membersChanged) return;
  throw refused(
    'TEAM_LOCKED',
    leadChanged ? 'teamLeadId' : 'teamMemberIds',
    'the investigation team is fixed once the investigation is accepted',
  );
}
