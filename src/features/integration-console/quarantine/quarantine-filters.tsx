import type { ExceptionFilters } from '@/api/v2/queries/ingestion-exceptions';
import type { ConnectionView, ExceptionState, IngestionErrorCode } from '@/api/v2/types/integrations';
import { FilterField } from '../components/filter-field';
import { NativeSelect } from '../components/native-select';
import { ERROR_CODE_INFO, ERROR_CODES } from '../model/exception-flow';

const STATES: ReadonlyArray<{ value: ExceptionState; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'irrecoverable', label: 'Cannot be recovered' },
];

export interface QuarantineFiltersProps {
  filters: ExceptionFilters;
  connections: readonly ConnectionView[];
  /** the connection is pinned by the page: no connection filter */
  fixedConnection?: boolean;
  onChange: (filters: ExceptionFilters) => void;
}

/** Server-side filters of the quarantine: connection (scope), problem, state — labels above, h-9, one row. */
export function QuarantineFilters({ filters, connections, fixedConnection = false, onChange }: QuarantineFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="quarantine-filters">
      <FilterField id="q-connection" label="Connection">
        <NativeSelect
          id="q-connection"
          testId="q-connection"
          value={filters.connectionId ?? ''}
          placeholder="Any connection"
          disabled={fixedConnection}
          options={connections.map((connection) => ({ value: connection.id, label: connection.displayName }))}
          onChange={(connectionId) => onChange({ ...filters, connectionId: connectionId || undefined })}
        />
      </FilterField>
      <FilterField id="q-code" label="Problem" className="w-full sm:w-56">
        <NativeSelect
          id="q-code"
          testId="q-code"
          value={filters.errorCode ?? ''}
          placeholder="Any problem"
          options={ERROR_CODES.map((code) => ({ value: code, label: ERROR_CODE_INFO[code].label }))}
          onChange={(code) => onChange({ ...filters, errorCode: (code || undefined) as IngestionErrorCode | undefined })}
        />
      </FilterField>
      <FilterField id="q-state" label="State">
        <NativeSelect id="q-state" value={filters.state ?? ''} placeholder="Any state" options={STATES} onChange={(state) => onChange({ ...filters, state: (state || undefined) as ExceptionState | undefined })} />
      </FilterField>
    </div>
  );
}
