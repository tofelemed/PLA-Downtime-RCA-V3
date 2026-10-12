import type { RcaRecommendationItem } from '@/api/v2/types/rca';

export const RECOMMENDATION_STATUSES = ['Open', 'Planned', 'In Progress', 'Completed', 'Cancelled'] as const;
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

export function recommendationFormOf(item: RcaRecommendationItem): RecommendationForm {
  return {
    title: item.title,
    description: item.description ?? '',
    priority: item.priority ?? 'Medium',
    ownerId: item.ownerId ?? '',
    dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
    status: item.status ?? 'Open',
    estimatedCost: item.estimatedCost ?? '',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** True when the cost is empty or a plain decimal (the server refuses anything else). */
export const isCostValid = (value: string) => value.trim() === '' || /^\d{1,13}(\.\d{1,4})?$/.test(value.trim());

export function recommendationItemOf(form: RecommendationForm, id: string): RcaRecommendationItem {
  return {
    id,
    title: form.title.trim(),
    description: orNull(form.description),
    priority: form.priority,
    ownerId: orNull(form.ownerId),
    dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null,
    status: form.status,
    estimatedCost: orNull(form.estimatedCost),
  };
}

/** Closed recommendations no longer need work (v1 counted Completed and Cancelled as closed). */
export const isRecommendationClosed = (status: string | null) =>
  status === 'Completed' || status === 'Cancelled' || status === 'done' || status === 'cancelled';
