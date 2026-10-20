import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SourceScope } from '../model/discovery';

/**
 * The PI read scope of the connection page (AF database or element, optional template) in the URL, so a
 * reload or a shared link keeps it and the jobs tab can create a job without re-running discovery.
 */
export function useSourceScope(): [SourceScope, (next: SourceScope) => void] {
  const [params, setParams] = useSearchParams();
  const scopeType = params.get('scopeType') === 'element' ? 'element' : 'database';
  const scopeId = params.get('scopeId') ?? '';
  const templateName = params.get('template');
  const scope = useMemo<SourceScope>(() => ({ scopeType, scopeId, templateName: templateName || null }), [scopeType, scopeId, templateName]);
  const set = useCallback(
    (next: SourceScope) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          write(copy, 'scopeId', next.scopeId);
          write(copy, 'scopeType', next.scopeId && next.scopeType === 'element' ? 'element' : '');
          write(copy, 'template', next.templateName ?? '');
          return copy;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [scope, set];
}

function write(params: URLSearchParams, name: string, value: string): void {
  if (value) params.set(name, value);
  else params.delete(name);
}
