import { useState } from 'react';
import type { Barrier, BarrierContent } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { BARRIER_EFFECTIVENESS, BARRIER_TYPES, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { ChoiceField, optionsOf } from '../../../evidence/form-controls';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

function BarrierRow(props: { barrier: Barrier; index: number; readOnly: boolean; onChange: (next: Barrier) => void; onRemove: () => void }) {
  const { barrier, index, readOnly } = props;
  const set = (patch: Partial<Barrier>) => props.onChange({ ...barrier, ...patch });
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-2" data-testid="barrier-row">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor={`barrier-${index}`}>Barrier {index + 1}</Label>
        <Input id={`barrier-${index}`} value={barrier.description} maxLength={1000} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <ChoiceField id={`barrier-type-${index}`} label="Kind" value={barrier.type} options={optionsOf(BARRIER_TYPES)} onChange={(type) => set({ type })} />
      <ChoiceField id={`barrier-effect-${index}`} label="Effectiveness" value={barrier.effectiveness} options={optionsOf(BARRIER_EFFECTIVENESS)} onChange={(effectiveness) => set({ effectiveness })} />
      <div className="space-y-1">
        <Label htmlFor={`barrier-why-${index}`}>Why it failed or was weak</Label>
        <Input id={`barrier-why-${index}`} value={barrier.failureReason ?? ''} maxLength={1000} disabled={readOnly} onChange={(e) => set({ failureReason: e.target.value || null })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`barrier-recs-${index}`}>Recommendations (separate with ;)</Label>
        <Input
          id={`barrier-recs-${index}`}
          value={barrier.recommendations.join('; ')}
          disabled={readOnly}
          onChange={(e) => set({ recommendations: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove barrier ${index + 1}`} onClick={props.onRemove} />}
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'barrier'>; save: (body: BarrierContent) => Promise<unknown> }) {
  const { number } = useNumberFormat();
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useState<BarrierContent>(() => ({ hazard: record?.hazard ?? (rca.description ?? rca.title).slice(0, 255), barriers: record?.barriers ?? [] }));
  const setBarriers = (barriers: Barrier[]) => setContent({ ...content, barriers });
  const failed = content.barriers.filter((b) => b.effectiveness === 'Failed').length;
  const add = () => setBarriers([...content.barriers, { id: rowId('barrier', content.barriers), type: 'Prevention', description: '', effectiveness: 'Moderate', failureReason: null, recommendations: [] }]);
  return (
    <div className="space-y-4" data-testid="barrier-tool">
      <div className="space-y-1">
        <Label htmlFor="barrier-hazard">Hazard</Label>
        <Input id="barrier-hazard" value={content.hazard} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, hazard: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">
        {number(content.barriers.length)} barrier(s), {number(failed)} failed.
      </p>
      <ul className="space-y-2">
        {content.barriers.map((barrier, index) => (
          <BarrierRow key={barrier.id} barrier={barrier} index={index} readOnly={readOnly} onChange={(next) => setBarriers(content.barriers.map((b) => (b.id === next.id ? next : b)))} onRemove={() => setBarriers(content.barriers.filter((b) => b.id !== barrier.id))} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={add}>
          Add barrier
        </Button>
      )}
      <SaveBar onSave={() => save(content)} disabled={content.hazard.trim() === '' || content.barriers.length === 0} hint="Name the hazard and add at least one barrier." label="Save barrier analysis" updatedAt={record?.updatedAt} />
    </div>
  );
}

/** Barrier analysis: the barriers between the hazard and the loss, and which of them failed. */
export function BarrierTool() {
  return <ToolFrame tool="barrier">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
