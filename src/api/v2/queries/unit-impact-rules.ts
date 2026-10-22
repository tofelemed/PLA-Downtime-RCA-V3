import type { BodyOf } from '../schema-types';
import type { UnitImpactRuleView } from '../types/unit-impact';
import { v2 } from '../v2';
import { useBaselineCommand } from './profile-commands';
import { usePagedQuery } from './use-paged-query';

export type UnitImpactRuleCreateBody = BodyOf<'/api/v2/unit-impact-rules', 'post'>;

export interface UnitImpactRuleFilters {
  /** one unit's rules (server filter); '' or undefined lists every unit's */
  unitId?: string;
  /** deep link to a rule on a later page: the first page starts at it (server keyset seek) */
  focus?: string;
}

/**
 * Unit impact rule versions the caller may read (plan 1.10), 20 per page with the numbered pager, filtered
 * on the server; approve / retire via `useVersionTransition`.
 */
export function useUnitImpactRules(filters: UnitImpactRuleFilters = {}) {
  const query = { unitId: filters.unitId || undefined, focus: filters.focus };
  return usePagedQuery<UnitImpactRuleView>({
    resource: 'profiles',
    path: '/unit-impact-rules',
    query,
    key: { filters: { kind: 'unit-impact-rules', ...query } },
  });
}

/** A draft rule; once another user approves it the asset's stops in its validity are resolved again. */
export function useCreateUnitImpactRule() {
  return useBaselineCommand<UnitImpactRuleCreateBody, UnitImpactRuleView>(async (body, idempotencyKey) =>
    (await v2.post<UnitImpactRuleView, '/api/v2/unit-impact-rules'>('/api/v2/unit-impact-rules', { body, idempotencyKey })).data,
  );
}
