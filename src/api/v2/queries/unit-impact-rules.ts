import type { BodyOf } from '../schema-types';
import type { UnitImpactRuleView } from '../types/unit-impact';
import { v2 } from '../v2';
import { useBaselineCommand } from './profile-commands';
import { useV2InfiniteList } from './use-v2-list';

export type UnitImpactRuleCreateBody = BodyOf<'/api/v2/unit-impact-rules', 'post'>;

/** Every unit impact rule version the caller may read (plan 1.10); approve / retire via `useVersionTransition`. */
export function useUnitImpactRules(focus?: string) {
  return useV2InfiniteList<UnitImpactRuleView>({
    resource: 'profiles',
    path: '/unit-impact-rules',
    query: { limit: 200, focus },
    key: { filters: { kind: 'unit-impact-rules', focus } },
  });
}

/** A draft rule; once another user approves it the asset's stops in its validity are resolved again. */
export function useCreateUnitImpactRule() {
  return useBaselineCommand<UnitImpactRuleCreateBody, UnitImpactRuleView>(async (body, idempotencyKey) =>
    (await v2.post<UnitImpactRuleView, '/api/v2/unit-impact-rules'>('/api/v2/unit-impact-rules', { body, idempotencyKey })).data,
  );
}
