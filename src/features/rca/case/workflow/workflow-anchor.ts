import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** DOM id of the Workflow card on Overview (deep links `/rca/<id>#rca-workflow`). */
export const WORKFLOW_ANCHOR = 'rca-workflow';

/** Scrolls to the Workflow card when the URL names it (a client-side link does not scroll by itself). */
export function useScrollToWorkflow(ready: boolean): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (ready && hash === `#${WORKFLOW_ANCHOR}`) document.getElementById(WORKFLOW_ANCHOR)?.scrollIntoView?.({ block: 'start' });
  }, [hash, ready]);
}
