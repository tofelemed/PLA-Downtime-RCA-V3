import { useState } from 'react';
import { useSourceSample, type SampleQuery } from '@/api/v2/queries/integration-connections';
import type { SampleRecordView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { BindSourceDialog } from '../mapping/bind-source-dialog';
import { MappingEditor } from '../mapping/mapping-editor';
import { sampleQuery, SAMPLE_MAX_HOURS, type SourceScope } from '../model/discovery';
import type { BindTarget } from '../model/exception-flow';
import { SampleTable } from './sample-table';
import { ScopePicker } from './scope-picker';

export interface DiscoveryPanelProps {
  connectionId: string;
  scope: SourceScope;
  timezone: string;
  onScope: (scope: SourceScope) => void;
  onSampled: () => void;
}

const bindTargetOf = (record: SampleRecordView): BindTarget | null =>
  record.element?.path
    ? { matchKind: 'exact_path', matchValue: record.element.path }
    : record.element?.webId
      ? { matchKind: 'exact_id', matchValue: record.element.webId }
      : null;

/** UX06 discover → map sample: pick the scope, sample recent records, map one, bind its element. */
export function DiscoveryPanel({ connectionId, scope, timezone, onScope, onSampled }: DiscoveryPanelProps) {
  const [hours, setHours] = useState('24');
  const [query, setQuery] = useState<SampleQuery | null>(null);
  const [selected, setSelected] = useState<SampleRecordView | null>(null);
  const [bindTarget, setBindTarget] = useState<BindTarget | null>(null);
  const [bound, setBound] = useState<string | null>(null);
  const sample = useSourceSample(connectionId, query);
  const hoursValue = Number(hours);
  const hoursValid = Number.isInteger(hoursValue) && hoursValue >= 1 && hoursValue <= SAMPLE_MAX_HOURS;
  const request = () => {
    if (!hoursValid) return;
    const next = sampleQuery(scope, hoursValue, Date.now());
    setQuery(next);
    setSelected(null);
    if (next) onSampled();
  };
  const state = query ? dataStateOf(sample, { isEmpty: (sample.data?.records.length ?? 0) === 0 }) : null;
  return (
    <section aria-label="Discovery" className="space-y-4" data-testid="discovery-panel">
      <ScopePicker connectionId={connectionId} scope={scope} onChange={onScope} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field id="sample-hours" label="Hours back" error={hoursValid ? undefined : `Whole hours from 1 to ${SAMPLE_MAX_HOURS}`}>
            <Input id="sample-hours" type="number" min={1} max={SAMPLE_MAX_HOURS} value={hours} aria-invalid={!hoursValid} onChange={(event) => setHours(event.target.value)} />
          </Field>
        </div>
        <Button size="sm" onClick={request} disabled={!scope.scopeId || !hoursValid} data-testid="sample-run">
          Sample records
        </Button>
      </div>
      {sample.error ? <ConsoleRefusal error={sample.error} /> : null}
      {state && state !== 'error' && state !== 'no-permission' && (
        <DataState state={state} detail={state === 'empty' ? 'No source records in this window and scope.' : undefined}>
          {sample.data && (
            <SampleTable sample={sample.data} timezone={timezone} selectedId={selected?.sourceObjectId ?? null} onMap={setSelected} onBind={(record) => setBindTarget(bindTargetOf(record))} />
          )}
        </DataState>
      )}
      {selected && <MappingEditor key={selected.sourceObjectId} connectionId={connectionId} sample={selected} timezone={timezone} />}
      {bound && (
        <p role="status" className="text-sm" data-testid="bind-done">
          {bound}
        </p>
      )}
      <BindSourceDialog connectionId={connectionId} target={bindTarget} onClose={() => setBindTarget(null)} onBound={(mapping) => setBound(`Bound ${mapping.matchValue} (rule v${mapping.version}).`)} />
    </section>
  );
}
