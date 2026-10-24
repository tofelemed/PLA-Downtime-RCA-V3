import type { Barrier, BarrierContent } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { plural } from '@/features/ux-kit/format/plural';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { BARRIER_EFFECTIVENESS, BARRIER_TYPES, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { useToolDraft } from '../tool-draft';
import { ToolChoiceField, ToolTextField } from '../tool-fields';
import { choicesOf } from '../tool-choices';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';

const splitList = (text: string) => text.split(';').map((s) => s.trim()).filter(Boolean);

function BarrierRow(props: { barrier: Barrier; index: number; readOnly: boolean; onChange: (next: Barrier) => void; onRemove: () => void }) {
  const { number } = useNumberFormat();
  const { barrier, index, readOnly } = props;
  const set = (patch: Partial<Barrier>) => props.onChange({ ...barrier, ...patch });
  return (
    <li className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[2fr_1fr_1fr_auto]" data-testid="barrier-row">
      <ToolTextField id={`barrier-${index}`} label={`Barrier ${number(index + 1)}`} value={barrier.description} maxLength={1000} onChange={(description) => set({ description })} />
      <ToolChoiceField id={`barrier-type-${index}`} label="Kind" value={barrier.type} options={choicesOf(BARRIER_TYPES)} onChange={(type) => set({ type })} />
      <ToolChoiceField id={`barrier-effect-${index}`} label="Effectiveness" value={barrier.effectiveness} options={choicesOf(BARRIER_EFFECTIVENESS)} onChange={(effectiveness) => set({ effectiveness })} />
      <div className="flex items-end">{!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove barrier ${index + 1}`} onClick={props.onRemove} />}</div>
      <ToolTextField id={`barrier-why-${index}`} label="Why it failed or was weak" value={barrier.failureReason ?? ''} maxLength={1000} onChange={(failureReason) => set({ failureReason: failureReason || null })} className="md:col-span-2" />
      <ToolTextField
        id={`barrier-recs-${index}`}
        label="Recommendations (separate with ;)"
        value={barrier.recommendations.join('; ')}
        onChange={(text) => set({ recommendations: splitList(text) })}
        className="md:col-span-2"
      />
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'barrier'>; save: (body: BarrierContent) => Promise<unknown> }) {
  const { number } = useNumberFormat();
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useToolDraft<BarrierContent>(() => ({ hazard: record?.hazard ?? (rca.description ?? rca.title).slice(0, 255), barriers: record?.barriers ?? [] }));
  const setBarriers = (barriers: Barrier[]) => setContent({ ...content, barriers });
  const failed = content.barriers.filter((b) => b.effectiveness === 'Failed').length;
  const add = () => setBarriers([...content.barriers, { id: rowId('barrier', content.barriers), type: 'Prevention', description: '', effectiveness: 'Moderate', failureReason: null, recommendations: [] }]);
  return (
    <div className="space-y-4" data-testid="barrier-tool">
      <ToolTextField id="barrier-hazard" label="Hazard" value={content.hazard} maxLength={255} onChange={(hazard) => setContent({ ...content, hazard })} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {plural(content.barriers.length, 'barrier', 'barriers', number)}, {number(failed)} failed
        </p>
        {!readOnly && (
          <Button type="button" variant="outline" className="h-9" onClick={add}>
            <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
            Add barrier
          </Button>
        )}
      </div>
      {content.barriers.length === 0 ? (
        <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">No barriers yet.</p>
      ) : (
        <ul className="space-y-2">
          {content.barriers.map((barrier, index) => (
            <BarrierRow key={barrier.id} barrier={barrier} index={index} readOnly={readOnly} onChange={(next) => setBarriers(content.barriers.map((b) => (b.id === next.id ? next : b)))} onRemove={() => setBarriers(content.barriers.filter((b) => b.id !== barrier.id))} />
          ))}
        </ul>
      )}
      <div className="border-t pt-3">
        <SaveBar onSave={() => save(content)} disabled={content.hazard.trim() === '' || content.barriers.length === 0} hint="Name the hazard and add at least one barrier." label="Save barrier analysis" updatedAt={record?.updatedAt} />
      </div>
    </div>
  );
}

/** Barrier analysis: the barriers between the hazard and the loss, and which of them failed. */
export function BarrierTool() {
  return <ToolFrame tool="barrier">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
