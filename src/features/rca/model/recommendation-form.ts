import { labelOf } from '@/features/ux-kit/labels';
import { RCA_RECOMMENDATION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { plantDayOf, plantDayStart } from './plant-day';

export const RECOMMENDATION_STATUSES = ['Open', 'Planned', 'In Progress', 'Completed', 'Cancelled'] as const;

/** Status choices in words (QA L2 / L3: sentence case, "Done" like an action); the stored values are unchanged. */
export const RECOMMENDATION_STATUS_OPTIONS = RECOMMENDATION_STATUSES.map((value) => ({ value, label: labelOf(RCA_RECOMMENDATION_STATUS_LABELS, value) }));
export const RECOMMENDATION_PRIORITIES = ['Low', 'Medium', 'High'] as const;

/** The recommendation page form; text fields hold '' for "not stated". */
export interface RecommendationForm {
  title: string;
  description: string;
  priority: string;
  ownerId: string;
  /** ISO calendar date or '' */
  dueDate: string;
  status: string;
  /** decimal text */
  estimatedCost: string;
}

export const EMPTY_RECOMMENDATION_FORM: RecommendationForm = {
  title: '',
  description: '',
  priority: 'Medium',
  ownerId: '',
  dueDate: '',
  status: 'Open',
  estimatedCost: '',
};

/** The form of a stored recommendation; its due day is the plant's day of the stored instant. */
export function recommendationFormOf(item: RcaRecommendationItem, timeZone: string): RecommendationForm {
  return {
    title: item.title,
    description: item.description ?? '',
    priority: item.priority ?? 'Medium',
    ownerId: item.ownerId ?? '',
    dueDate: plantDayOf(item.dueDate, timeZone),
    status: item.status ?? 'Open',
    estimatedCost: item.estimatedCost ?? '',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** True when the cost is empty or a plain decimal (the server refuses anything else). */
export const isCostValid = (value: string) => value.trim() === '' || /^\d{1,13}(\.\d{1,4})?$/.test(value.trim());

/** The stored item; the due day is sent as the instant the plant day starts. */
export function recommendationItemOf(form: RecommendationForm, id: string, timeZone: string): RcaRecommendationItem {
  return {
    id,
    title: form.title.trim(),
    description: orNull(form.description),
    priority: form.priority,
    ownerId: orNull(form.ownerId),
    dueDate: plantDayStart(form.dueDate, timeZone),
    status: form.status,
    estimatedCost: orNull(form.estimatedCost),
  };
}

/** Closed recommendations no longer need work (v1 counted Completed and Cancelled as closed). */
export const isRecommendationClosed = (status: string | null) =>
  status === 'Completed' || status === 'Cancelled' || status === 'done' || status === 'cancelled';

/** Item 5: the stored fields of recommendations sent back with the case (the read-only `actions` stay out). */
export function storedRecommendations(rows: readonly RcaRecommendationItem[]): Array<Omit<RcaRecommendationItem, 'actions'>> {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    ownerId: row.ownerId,
    dueDate: row.dueDate,
    status: row.status,
    estimatedCost: row.estimatedCost,
  }));
}
