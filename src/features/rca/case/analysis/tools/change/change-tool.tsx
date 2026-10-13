import { useState } from 'react';
import type { ChangeContent, ChangeRecord } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { IconButton } from '@/features/ux-kit/icon-button';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { plantToday } from '@/lib/dates/zoned-time';
import { ActionIcon } from '@/lib/icons';
import { CHANGE_CATEGORIES, LIKELIHOODS, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { ChoiceField, optionsOf } from '../../../evidence/form-controls';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';

function ChangeRow(props: { change: ChangeRecord; index: number; readOnly: boolean; onChange: (next: ChangeRecord) => void; onRemove: () => void }) {
  const { change, index, readOnly } = props;
  const set = (patch: Partial<ChangeRecord>) => props.onChange({ ...change, ...patch });
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-2" data-testid="change-row">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor={`change-${index}`}>Change {index + 1}</Label>
        <Input id={`change-${index}`} value={change.description} maxLength={1000} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <ChoiceField id={`change-category-${index}`} label="Area" value={change.category} options={optionsOf(CHANGE_CATEGORIES)} onChange={(category) => set({ category })} />
      <ChoiceField id={`change-impact-${index}`} label="Impact" value={change.impactLevel} options={optionsOf(LIKELIHOODS)} onChange={(impactLevel) => set({ impactLevel })} />
      <DateInput id={`change-date-${index}`} label="Date of the change" value={change.changeDate} disabled={readOnly} onChange={(changeDate) => set({ changeDate })} />
      <div className="flex items-center gap-2 pt-6">
        <Checkbox id={`change-related-${index}`} checked={change.relatedToIncident} disabled={readOnly} onCheckedChange={(value) => set({ relatedToIncident: value === true })} />
        <Label htmlFor={`change-related-${index}`}>Related to the incident</Label>
      </div>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove change ${index + 1}`} onClick={props.onRemove} />}
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'change'>; save: (body: ChangeContent) => Promise<unknown> }) {
  const { readOnly } = useCaseWorkspace();
  const zone = usePlantTimezone();
  const [content, setContent] = useState<ChangeContent>(() => ({ question: record?.question ?? 'What changed before the incident?', changes: record?.changes ?? [] }));
  const setChanges = (changes: ChangeRecord[]) => setContent({ ...content, changes });
  const related = content.changes.filter((c) => c.relatedToIncident).length;
  const add = () => setChanges([...content.changes, { id: rowId('change', content.changes), category: 'Process', description: '', changeDate: plantToday(zone.timezone), relatedToIncident: false, impactLevel: 'Medium' }]);
  const valid = content.changes.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.changeDate));
  return (
    <div className="space-y-4" data-testid="change-tool">
      <div className="space-y-1">
        <Label htmlFor="change-question">Question</Label>
        <Input id="change-question" value={content.question} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, question: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">
        {content.changes.length} change(s), {related} related to the incident.
      </p>
      <ul className="space-y-2">
        {content.changes.map((change, index) => (
          <ChangeRow key={change.id} change={change} index={index} readOnly={readOnly} onChange={(next) => setChanges(content.changes.map((c) => (c.id === next.id ? next : c)))} onRemove={() => setChanges(content.changes.filter((c) => c.id !== change.id))} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={add}>
          Add change
        </Button>
      )}
      <SaveBar onSave={() => save(content)} disabled={content.question.trim() === '' || content.changes.length === 0 || !valid} hint="Ask the question, add a change and give each change a date." label="Save change analysis" updatedAt={record?.updatedAt} />
    </div>
  );
}

/** Change analysis: what changed (people, equipment, process …) and whether it relates to the incident. */
export function ChangeTool() {
  return <ToolFrame tool="change">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
