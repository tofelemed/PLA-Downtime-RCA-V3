import { RcaEvidenceItemDto } from '../v2/rca/rca-case-items-v2.dto';
import { RcaEvidenceItem } from './rca-case-json';

/**
 * F-11: who verified an evidence item and when, recorded by the server (values sent by a client are
 * ignored). An item that becomes verified gets the actor and time; one that stays verified keeps what was
 * recorded (by id); one that is not verified has neither.
 */
export function attributeEvidence(
  previous: readonly RcaEvidenceItem[],
  next: readonly RcaEvidenceItemDto[],
  actor: { userId: string | null; now: Date },
): RcaEvidenceItemDto[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  return next.map((item) => {
    if (item.verified !== true)
      return { ...item, verifiedBy: null, verifiedAt: null };
    const kept = item.id ? before.get(item.id) : undefined;
    if (kept?.verified === true)
      return {
        ...item,
        verifiedBy: kept.verifiedBy,
        verifiedAt: kept.verifiedAt,
      };
    return {
      ...item,
      verifiedBy: actor.userId,
      verifiedAt: actor.now.toISOString(),
    };
  });
}

/** Distinct evidence task assignees of a body (validated as users of the tenant). */
export const evidenceAssignees = (
  items: readonly RcaEvidenceItemDto[] | undefined,
): string[] => [
  ...new Set(
    (items ?? [])
      .map((item) => item.taskAssigneeId)
      .filter((id): id is string => typeof id === 'string'),
  ),
];
