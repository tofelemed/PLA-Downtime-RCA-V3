import type { RcaCaseView, RcaRecommendationItem } from '@/api/v2/types/rca';
import type { CreateTaskInput, TaskPriority, TaskStatus } from '@/api/v2/types/administration';

const STATUSES: readonly TaskStatus[] = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES: readonly TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];

const status = (value: string | null): TaskStatus => STATUSES.find((s) => s === value) ?? 'Open';
const priority = (value: string | null): TaskPriority => PRIORITIES.find((p) => p === value) ?? 'Medium';

/** A task for one recommendation, linked to the case (owner = the recommendation's owner, else you). */
export function recommendationTask(rca: Pick<RcaCaseView, 'id' | 'title'>, rec: RcaRecommendationItem, userId: string): CreateTaskInput {
  return {
    title: rec.title,
    description: [rec.description, `Recommendation of RCA case "${rca.title}"`, rec.estimatedCost ? `Estimated cost: ${rec.estimatedCost}` : ''].filter(Boolean).join('\n'),
    assigneeId: rec.ownerId ?? userId,
    priority: priority(rec.priority),
    status: status(rec.status),
    dueDate: rec.dueDate ?? undefined,
    linkType: 'RCA',
    linkId: rca.id,
  };
}

/** A follow-up task for the whole case, assigned to you. */
export function caseTask(rca: Pick<RcaCaseView, 'id' | 'title' | 'description'>, userId: string): CreateTaskInput {
  return {
    title: `RCA follow-up: ${rca.title}`,
    description: rca.description ?? undefined,
    assigneeId: userId,
    priority: 'Medium',
    status: 'Open',
    linkType: 'RCA',
    linkId: rca.id,
  };
}
