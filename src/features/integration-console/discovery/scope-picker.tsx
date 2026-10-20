import { useState } from 'react';
import { useDiscovery } from '@/api/v2/queries/integration-connections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { databaseOptions, scopeTypeOfWebId, type SourceScope } from '../model/discovery';

const SCOPE_TYPES = [
  { value: 'database', label: 'AF database' },
  { value: 'element', label: 'AF element (and its event frames)' },
] as const;

export interface ScopePickerProps {
  connectionId: string;
  scope: SourceScope;
  onChange: (scope: SourceScope) => void;
}

/**
 * Where to read from: "Discover" lists the AF databases the connection can see (server-side, with the
 * stored credentials); a database WebId can also be typed. The template narrows samples and jobs.
 */
export function ScopePicker({ connectionId, scope, onChange }: ScopePickerProps) {
  const [requested, setRequested] = useState(false);
  const discovery = useDiscovery(connectionId, requested);
  const options = databaseOptions(discovery.data);
  return (
    <div className="space-y-2" data-testid="scope-picker">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="outline" onClick={() => (requested ? void discovery.refetch() : setRequested(true))} data-testid="discover">
          {discovery.isFetching ? 'Discovering…' : 'Discover AF databases'}
        </Button>
        {options.length > 0 && (
          <div className="min-w-56">
            <NativeSelect
              id="af-database"
              testId="af-database"
              value={scope.scopeId}
              placeholder="Choose a database"
              options={options}
              onChange={(scopeId) => onChange({ ...scope, scopeType: 'database', scopeId })}
            />
          </div>
        )}
      </div>
      <ConsoleRefusal error={discovery.error} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Field id="scope-type" label="Read from">
          <NativeSelect
            id="scope-type"
            testId="scope-type"
            value={scope.scopeType}
            options={SCOPE_TYPES}
            onChange={(scopeType) => onChange({ ...scope, scopeType: scopeType === 'element' ? 'element' : 'database' })}
          />
        </Field>
        <Field id="scope-id" label={scope.scopeType === 'element' ? 'AF element WebId' : 'AF database WebId'}>
          <Input
            id="scope-id"
            value={scope.scopeId}
            onChange={(event) => {
              const scopeId = event.target.value.trim();
              onChange({ ...scope, scopeId, scopeType: scopeTypeOfWebId(scopeId) ?? scope.scopeType });
            }}
          />
        </Field>
        <Field id="scope-template" label="Template (optional)">
          <Input
            id="scope-template"
            value={scope.templateName ?? ''}
            onChange={(event) => onChange({ ...scope, templateName: event.target.value === '' ? null : event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
