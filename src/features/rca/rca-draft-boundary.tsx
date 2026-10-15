import { useEffect, useLayoutEffect } from 'react';
import { useRcaDraftOwner } from './case/definition/use-definition-draft';
import { retainedDefinitionDrafts } from './case/definition/retained-definition-drafts';

/** Outside routes, so reload also warns after leaving an unfinished case definition. */
export function RcaDraftBoundary(): null {
  const owner = useRcaDraftOwner();
  useLayoutEffect(() => { retainedDefinitionDrafts.setOwner(owner); }, [owner]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (retainedDefinitionDrafts.hasPending()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return null;
}
