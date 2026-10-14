import type { WithRevaluation } from '../types/valuation';

type Versioned = WithRevaluation & { id: string };

const withoutRevaluation = (view: Versioned): string => {
  const { revaluation: _ignored, ...rest } = view;
  return JSON.stringify(rest);
};

/**
 * SME V7: an approve / retire answer names the revaluation it queued, but a plain read of the version
 * does not. The command writes its answer into the detail cache and then invalidates it, so the refetch
 * would drop the notice the moment it appeared. The refetched view keeps the cached `revaluation` while
 * the version is otherwise unchanged (same id, same fields); any other change drops it.
 */
export function carryRevaluation<T extends Versioned>(cached: T | undefined, fresh: T): T {
  if (!cached?.revaluation || fresh.revaluation !== undefined || cached.id !== fresh.id) return fresh;
  return withoutRevaluation(cached) === withoutRevaluation(fresh) ? { ...fresh, revaluation: cached.revaluation } : fresh;
}
