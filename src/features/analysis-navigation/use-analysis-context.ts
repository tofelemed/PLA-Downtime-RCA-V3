import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { readAnalysisContext, type AnalysisContext } from './analysis-context';

/** The analysis context (B-8) of the current URL: units, window and approved-only, as far as it names them. */
export function useAnalysisContext(): AnalysisContext {
  const { search } = useLocation();
  return useMemo(() => readAnalysisContext(search), [search]);
}
