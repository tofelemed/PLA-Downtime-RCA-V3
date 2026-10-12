import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ExceptionFilters } from '@/api/v2/queries/ingestion-exceptions';
import type { ExceptionState, IngestionErrorCode } from '@/api/v2/types/integrations';
import { ERROR_CODES } from '../model/exception-flow';

const STATES: readonly ExceptionState[] = ['open', 'resolved', 'irrecoverable'];
const ANY = 'any';

/**
 * Quarantine filters in the URL (`state`, `code`, `connection`) so Back and links keep them. The state
 * defaults to open; `fixedConnectionId` pins the connection (a connection's own quarantine tab).
 */
export function useQuarantineFilters(fixedConnectionId?: string): [ExceptionFilters, (next: ExceptionFilters) => void] {
  const [params, setParams] = useSearchParams();
  const rawState = params.get('state');
  const rawCode = params.get('code');
  const filters = useMemo<ExceptionFilters>(() => {
    const state = rawState === ANY ? undefined : STATES.find((value) => value === rawState) ?? 'open';
    const errorCode = ERROR_CODES.find((code) => code === rawCode) as IngestionErrorCode | undefined;
    const connectionId = fixedConnectionId ?? params.get('connection') ?? undefined;
    return { state, errorCode, connectionId };
  }, [rawState, rawCode, fixedConnectionId, params]);
  const set = useCallback(
    (next: ExceptionFilters) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          const put = (name: string, value: string | undefined) => (value ? copy.set(name, value) : copy.delete(name));
          put('state', next.state === 'open' ? undefined : next.state ?? ANY);
          put('code', next.errorCode);
          if (!fixedConnectionId) put('connection', next.connectionId);
          return copy;
        },
        { replace: true },
      ),
    [setParams, fixedConnectionId],
  );
  return [filters, set];
}
