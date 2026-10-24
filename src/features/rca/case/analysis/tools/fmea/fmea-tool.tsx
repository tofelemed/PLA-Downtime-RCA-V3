import type { FmeaCause, FmeaContent, FmeaEffect } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { useToolDraft } from '../tool-draft';
import { ToolTextField } from '../tool-fields';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { causeStatus, contentOf, rpnText, rulesText } from './fmea-model';
import { CauseRow, EffectRow } from './fmea-rows';
import { FmeaTable, type FmeaColumn } from './fmea-table';

const replaced = <T extends { id: string }>(items: readonly T[], next: T) => items.map((item) => (item.id === next.id ? next : item));
const without = <T extends { id: string }>(items: readonly T[], id: string) => items.filter((item) => item.id !== id);

const EFFECT_COLUMNS: FmeaColumn[] = [{ label: '#', numeric: true }, { label: 'Effect' }, { label: 'Severity', numeric: true }, { label: 'Current controls' }];
const CAUSE_COLUMNS: FmeaColumn[] = [
  { label: '#', numeric: true },
  { label: 'Cause' },
  { label: 'Occurrence', numeric: true },
  { label: 'Detection', numeric: true },
  { label: 'Detection control' },
  { label: 'Recommended actions' },
  { label: 'RPN', numeric: true },
  { label: 'Assessment' },
];

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="h-9" onClick={onClick}>
      <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
      {label}
    </Button>
  );
}

interface SectionProps {
  content: FmeaContent;
  setContent: (next: FmeaContent) => void;
  readOnly: boolean;
}

function EffectsSection({ content, setContent, readOnly }: SectionProps) {
  const setEffects = (effects: FmeaEffect[]) => setContent({ ...content, effects });
  const addEffect = () => setEffects([...content.effects, { id: rowId('effect', content.effects), description: '', severity: null, currentControls: '' }]);
  return (
    <>
      <FmeaTable title="Effects" info="Severity 1–10 of each effect; the worst one counts for every cause." columns={EFFECT_COLUMNS} editable={!readOnly} empty={content.effects.length === 0}>
        {content.effects.map((effect, index) => (
          <EffectRow key={effect.id} item={effect} index={index} readOnly={readOnly} onChange={(next) => setEffects(replaced(content.effects, next))} onRemove={() => setEffects(without(content.effects, effect.id))} />
        ))}
      </FmeaTable>
      {!readOnly && <AddRowButton label="Add effect" onClick={addEffect} />}
    </>
  );
}

function CausesSection({ content, setContent, readOnly, record }: SectionProps & { record: ToolRecord<'fmea'> }) {
  const scored = (id: string) => record?.causes.find((cause) => cause.id === id);
  const setCauses = (causes: FmeaCause[]) => setContent({ ...content, causes });
  const addCause = () =>
    setCauses([...content.causes, { id: rowId('cause', content.causes), description: '', occurrence: null, detection: null, detectionControl: null, recommendedActions: [] }]);
  return (
    <>
      <FmeaTable title="Causes" info={`Occurrence and detection 1–10, detection by the cause's own control. ${rulesText(record)}`} columns={CAUSE_COLUMNS} editable={!readOnly} empty={content.causes.length === 0}>
        {content.causes.map((cause, index) => (
          <CauseRow
            key={cause.id}
            item={cause}
            index={index}
            rpn={rpnText(scored(cause.id))}
            status={causeStatus(scored(cause.id))}
            readOnly={readOnly}
            onChange={(next) => setCauses(replaced(content.causes, next))}
            onRemove={() => setCauses(without(content.causes, cause.id))}
          />
        ))}
      </FmeaTable>
      {record && !record.complete && (
        <p className="flex items-center gap-1.5 text-sm" data-testid="fmea-incomplete">
          <StatusIcon.warning aria-hidden="true" className="h-4 w-4" />
          Not every rating is filled in yet.
        </p>
      )}
      {!readOnly && <AddRowButton label="Add cause" onClick={addCause} />}
    </>
  );
}

function Editor({ record, save }: { record: ToolRecord<'fmea'>; save: (body: FmeaContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useToolDraft<FmeaContent>(() => contentOf(record, rca.title.slice(0, 255)));
  const section = { content, setContent, readOnly };
  return (
    <div className="space-y-5" data-testid="fmea-tool">
      <ToolTextField id="fmea-mode" label="Failure mode" value={content.failureMode} maxLength={255} onChange={(failureMode) => setContent({ ...content, failureMode })} />
      <EffectsSection {...section} />
      <CausesSection {...section} record={record} />
      <div className="border-t pt-3">
        <SaveBar
          onSave={() => save(content)}
          disabled={content.failureMode.trim() === '' || content.effects.length === 0 || content.causes.length === 0}
          hint="Name the failure mode and add an effect and a cause; ratings may be filled in later."
          label="Save FMEA"
          updatedAt={record?.updatedAt}
        />
      </div>
    </div>
  );
}

/** FMEA: effects and causes of a failure mode, scored by the server with the RCA policy's rules. */
export function FmeaTool() {
  return <ToolFrame tool="fmea">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
