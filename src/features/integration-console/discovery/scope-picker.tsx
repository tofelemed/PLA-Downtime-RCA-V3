import { useState } from 'react';
import { useDiscovery } from '@/api/v2/queries/integration-connections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { databaseOptions, type SourceScope } from '../model/discovery';

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
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id="scope-id" label="AF database or element WebId">
          <Input id="scope-id" value={scope.scopeId} onChange={(event) => onChange({ ...scope, scopeId: event.target.value.trim() })} />
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
