import type { ChangeContent, ChangeRecord } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { plural } from '@/features/ux-kit/format/plural';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { plantToday } from '@/lib/dates/zoned-time';
import { ActionIcon } from '@/lib/icons';
import { CHANGE_CATEGORIES, LIKELIHOODS, rowId } from '../../../../model/analysis-settings';
import { useRcaFormat } from '../../../../use-rca-format';
import { useCaseWorkspace } from '../../../case-context';
import { useToolDraft } from '../tool-draft';
import { ReadField, ToolChoiceField, ToolTextField } from '../tool-fields';
import { choicesOf } from '../tool-choices';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';

/** Date and "related" of a change: the date picker and checkbox while editable, words when read-only. */
function DateAndRelated({ change, index, readOnly, set }: { change: ChangeRecord; index: number; readOnly: boolean; set: (patch: Partial<ChangeRecord>) => void }) {
  const { day } = useRcaFormat();
  if (readOnly) {
    return (
      <>
        <ReadField label="Date of the change" value={day(change.changeDate)} />
        <ReadField label="Related to the incident" value={change.relatedToIncident ? 'Yes' : 'No'} />
      </>
    );
  }
  return (
    <>
      <DateInput id={`change-date-${index}`} label="Date of the change" value={change.changeDate} onChange={(changeDate) => set({ changeDate })} />
      <div className="flex items-center gap-2 md:pt-7">
        <Checkbox id={`change-related-${index}`} checked={change.relatedToIncident} onCheckedChange={(value) => set({ relatedToIncident: value === true })} />
        <Label htmlFor={`change-related-${index}`}>Related to the incident</Label>
      </div>
    </>
  );
}

function ChangeRow(props: { change: ChangeRecord; index: number; readOnly: boolean; onChange: (next: ChangeRecord) => void; onRemove: () => void }) {
  const { number } = useNumberFormat();
  const { change, index, readOnly } = props;
  const set = (patch: Partial<ChangeRecord>) => props.onChange({ ...change, ...patch });
  return (
    <li className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[2fr_1fr_1fr_auto]" data-testid="change-row">
      <ToolTextField id={`change-${index}`} label={`Change ${number(index + 1)}`} value={change.description} maxLength={1000} onChange={(description) => set({ description })} />
      <ToolChoiceField id={`change-category-${index}`} label="Area" value={change.category} options={choicesOf(CHANGE_CATEGORIES)} onChange={(category) => set({ category })} />
      <ToolChoiceField id={`change-impact-${index}`} label="Impact" value={change.impactLevel} options={choicesOf(LIKELIHOODS)} onChange={(impactLevel) => set({ impactLevel })} />
      <div className="flex items-end">{!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove change ${index + 1}`} onClick={props.onRemove} />}</div>
      <DateAndRelated change={change} index={index} readOnly={readOnly} set={set} />
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'change'>; save: (body: ChangeContent) => Promise<unknown> }) {
  const { number } = useNumberFormat();
  const { readOnly } = useCaseWorkspace();
  const zone = usePlantTimezone();
  const [content, setContent] = useToolDraft<ChangeContent>(() => ({ question: record?.question ?? 'What changed before the incident?', changes: record?.changes ?? [] }));
  const setChanges = (changes: ChangeRecord[]) => setContent({ ...content, changes });
  const related = content.changes.filter((c) => c.relatedToIncident).length;
  const add = () => setChanges([...content.changes, { id: rowId('change', content.changes), category: 'Process', description: '', changeDate: plantToday(zone.timezone), relatedToIncident: false, impactLevel: 'Medium' }]);
  const valid = content.changes.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.changeDate));
  return (
    <div className="space-y-4" data-testid="change-tool">
      <ToolTextField id="change-question" label="Question" value={content.question} maxLength={255} onChange={(question) => setContent({ ...content, question })} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {plural(content.changes.length, 'change', 'changes', number)}, {number(related)} related to the incident
        </p>
        {!readOnly && (
          <Button type="button" variant="outline" className="h-9" onClick={add}>
            <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
            Add change
          </Button>
        )}
      </div>
      {content.changes.length === 0 ? (
        <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">No changes yet.</p>
      ) : (
        <ul className="space-y-2">
          {content.changes.map((change, index) => (
            <ChangeRow key={change.id} change={change} index={index} readOnly={readOnly} onChange={(next) => setChanges(content.changes.map((c) => (c.id === next.id ? next : c)))} onRemove={() => setChanges(content.changes.filter((c) => c.id !== change.id))} />
          ))}
        </ul>
      )}
      <div className="border-t pt-3">
        <SaveBar onSave={() => save(content)} disabled={content.question.trim() === '' || content.changes.length === 0 || !valid} hint="Ask the question, add a change and give each change a date." label="Save change analysis" updatedAt={record?.updatedAt} />
      </div>
    </div>
  );
}

/** Change analysis: what changed (people, equipment, process …) and whether it relates to the incident. */
export function ChangeTool() {
  return <ToolFrame tool="change">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
