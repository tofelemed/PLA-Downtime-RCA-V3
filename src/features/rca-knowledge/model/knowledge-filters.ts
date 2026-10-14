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

const choice = (value: string | null) => (value && value !== ALL ? value : ALL);

/** Filters kept in the URL (`?q=&unitId=&reasonCodeId=&published=`), so Back and links keep them. */
export function filtersFromParams(params: URLSearchParams): KnowledgeFilterState {
  const published = params.get('published');
  return {
    text: params.get('q') ?? '',
    unitId: choice(params.get('unitId')),
    reasonCodeId: choice(params.get('reasonCodeId')),
    published: published === 'published' || published === 'unpublished' ? published : ALL,
  };
}

export function paramsFromFilters(state: KnowledgeFilterState): Record<string, string> {
  const entries: Array<[string, string]> = [
    ['q', state.text.trim()],
    ['unitId', state.unitId],
    ['reasonCodeId', state.reasonCodeId],
    ['published', state.published],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== '' && value !== ALL));
}

/** Labels of the server's quality factors (`src/domain/rca/knowledge-quality.ts`). */
export const QUALITY_FACTOR_LABELS: Readonly<Record<string, string>> = {
  rootCause: 'Root cause written',
  problem: 'Problem statement',
  recommendations: 'Recommendations',
  actions: 'Actions tracked',
  effective: 'Verified effective',
  scope: 'Unit or asset named',
  sourceCase: 'Linked case',
  feedback: 'Helpful votes',
};

export const MATCH_LABELS: Readonly<Record<string, string>> = {
  failure_mode: 'same failure mode',
  asset: 'same asset',
  reason: 'same reason',
  unit: 'same unit',
  text: 'similar words',
};

/** Roles that may publish (backend `RCA_WRITERS`; SuperAdmin / OrgAdmin hold every scope role). */
const PUBLISHER_ROLES = ['SuperAdmin', 'OrgAdmin', 'reliability_engineer', 'manager_approver'];

export function canPublishKnowledge(roles: readonly string[]): boolean {
  return roles.some((role) => PUBLISHER_ROLES.includes(role));
}

/** Roles that may share a lesson with the other plants (backend `@Roles('manager_approver')`, SME CA9). */
const SHARER_ROLES = ['SuperAdmin', 'OrgAdmin', 'manager_approver'];

export function canShareKnowledge(roles: readonly string[]): boolean {
  return roles.some((role) => SHARER_ROLES.includes(role));
}
