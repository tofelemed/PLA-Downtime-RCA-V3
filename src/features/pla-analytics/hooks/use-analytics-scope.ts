import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseScope, SCOPE_PARAMS, scopeToParams, type AnalyticsScope } from '../model/analytics-scope';

export interface AnalyticsScopeState {
  scope: AnalyticsScope;
  /** merges a change into the URL (shareable, one history entry per change) */
  change: (patch: Partial<AnalyticsScope>) => void;
}

/** The scope's parameters plus every other parameter of the page (e.g. `?view=` of Reports). */
function withOthers(scope: AnalyticsScope, current: URLSearchParams): URLSearchParams {
  const next = scopeToParams(scope);
  current.forEach((value, key) => {
    if (!SCOPE_PARAMS.has(key)) next.set(key, value);
  });
  return next;
}

/**
 * The analytics scope in the URL (plan 3.6 step 1). The default window is anchored to the instant the
 * page was opened and written to the URL once, so a reload or a shared link shows the same window.
 */
export function useAnalyticsScope(): AnalyticsScopeState {
  const [params, setParams] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const scope = useMemo(() => parseScope(params, openedAt), [params, openedAt]);

  useEffect(() => {
    if (!params.get('from') || !params.get('to')) setParams((current) => withOthers(scope, current), { replace: true });
  }, [params, scope, setParams]);

  const change = useCallback(
    (patch: Partial<AnalyticsScope>) => setParams((current) => withOthers({ ...scope, ...patch }, current)),
    [scope, setParams],
  );
  return { scope, change };
}
