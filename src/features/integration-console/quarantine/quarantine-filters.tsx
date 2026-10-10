import type { ExceptionFilters } from '@/api/v2/queries/ingestion-exceptions';
import type { ConnectionView, ExceptionState, IngestionErrorCode } from '@/api/v2/types/integrations';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { ERROR_CODE_INFO, ERROR_CODES } from '../model/exception-flow';

const STATES: ReadonlyArray<{ value: ExceptionState; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'irrecoverable', label: 'Irrecoverable' },
];

export interface QuarantineFiltersProps {
  filters: ExceptionFilters;
  connections: readonly ConnectionView[];
  onChange: (filters: ExceptionFilters) => void;
}

/** Server-side filters of the quarantine: state, error code, connection. */
export function QuarantineFilters({ filters, connections, onChange }: QuarantineFiltersProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" data-testid="quarantine-filters">
      <Field id="q-state" label="State">
        <NativeSelect id="q-state" value={filters.state ?? ''} placeholder="Any state" options={STATES} onChange={(state) => onChange({ ...filters, state: (state || undefined) as ExceptionState | undefined })} />
      </Field>
      <Field id="q-code" label="Error code">
        <NativeSelect
          id="q-code"
          testId="q-code"
          value={filters.errorCode ?? ''}
          placeholder="Any code"
          options={ERROR_CODES.map((code) => ({ value: code, label: ERROR_CODE_INFO[code].label }))}
          onChange={(code) => onChange({ ...filters, errorCode: (code || undefined) as IngestionErrorCode | undefined })}
        />
      </Field>
      <Field id="q-connection" label="Connection">
        <NativeSelect
          id="q-connection"
          testId="q-connection"
          value={filters.connectionId ?? ''}
          placeholder="Any connection"
          options={connections.map((connection) => ({ value: connection.id, label: connection.displayName }))}
          onChange={(connectionId) => onChange({ ...filters, connectionId: connectionId || undefined })}
        />
      </Field>
    </div>
  );
}
