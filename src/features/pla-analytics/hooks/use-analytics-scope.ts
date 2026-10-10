import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseScope, scopeToParams, type AnalyticsScope } from '../model/analytics-scope';

export interface AnalyticsScopeState {
  scope: AnalyticsScope;
  /** merges a change into the URL (shareable, one history entry per change) */
  change: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * The PLA Analytics scope in the URL (plan 3.6 step 1). The default window is anchored to the instant the
 * page was opened and written to the URL once, so a reload or a shared link shows the same window.
 */
export function useAnalyticsScope(): AnalyticsScopeState {
  const [params, setParams] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const scope = useMemo(() => parseScope(params, openedAt), [params, openedAt]);

  useEffect(() => {
    if (!params.get('from') || !params.get('to')) setParams(scopeToParams(scope), { replace: true });
  }, [params, scope, setParams]);

  const change = useCallback((patch: Partial<AnalyticsScope>) => setParams(scopeToParams({ ...scope, ...patch })), [scope, setParams]);
  return { scope, change };
}
