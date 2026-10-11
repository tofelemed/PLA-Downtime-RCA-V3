import type { RcaKnowledgeFilters } from '@/api/v2/queries/rca-knowledge';

export const ALL = 'all';

export type PublishedChoice = typeof ALL | 'published' | 'unpublished';

/** What the filter bar holds (select values use `ALL` for "no filter"). */
export interface KnowledgeFilterState {
  text: string;
  unitId: string;
  reasonCodeId: string;
  published: PublishedChoice;
}

export const EMPTY_FILTERS: KnowledgeFilterState = { text: '', unitId: ALL, reasonCodeId: ALL, published: ALL };

/** Filter bar state → server query (`q` is the debounced, trimmed text); nothing is filtered locally. */
export function toKnowledgeQuery(state: KnowledgeFilterState, q: string): RcaKnowledgeFilters {
  const pick = (value: string) => (value === ALL ? undefined : value);
  return {
    q: q.trim() || undefined,
    unitId: pick(state.unitId),
    reasonCodeId: pick(state.reasonCodeId),
    published: state.published === ALL ? undefined : state.published === 'published',
  };
}

/** Labels of the server's quality factors (`src/domain/rca/knowledge-quality.ts`). */
export const QUALITY_FACTOR_LABELS: Readonly<Record<string, string>> = {
  rootCause: 'Root cause written',
  problem: 'Problem statement',
  recommendations: 'Recommendations',
  actions: 'Actions tracked',
  actionsDone: 'Actions done',
  scope: 'Unit or asset named',
  sourceCase: 'Linked case',
  feedback: 'Helpful votes',
};

export const MATCH_LABELS: Readonly<Record<string, string>> = {
  asset: 'same asset',
  reason: 'same reason',
  unit: 'same unit',
};

/** Roles that may publish (backend `RCA_WRITERS`; SuperAdmin / OrgAdmin hold every scope role). */
const PUBLISHER_ROLES = ['SuperAdmin', 'OrgAdmin', 'reliability_engineer', 'manager_approver'];

export function canPublishKnowledge(roles: readonly string[]): boolean {
  return roles.some((role) => PUBLISHER_ROLES.includes(role));
}
