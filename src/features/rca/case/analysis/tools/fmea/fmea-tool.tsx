import { useState } from 'react';
import type { FmeaCause, FmeaContent, FmeaEffect } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { causeScore, contentOf, rulesText } from './fmea-model';
import { CauseRow, EffectRow } from './fmea-rows';

const replaced = <T extends { id: string }>(items: readonly T[], next: T) => items.map((item) => (item.id === next.id ? next : item));
const without = <T extends { id: string }>(items: readonly T[], id: string) => items.filter((item) => item.id !== id);

function Editor({ record, save }: { record: ToolRecord<'fmea'>; save: (body: FmeaContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useState<FmeaContent>(() => contentOf(record, rca.title.slice(0, 255)));
  const scored = (id: string) => causeScore(record?.causes.find((cause) => cause.id === id), record?.method);
  const setEffects = (effects: FmeaEffect[]) => setContent({ ...content, effects });
  const setCauses = (causes: FmeaCause[]) => setContent({ ...content, causes });
  const addEffect = () => setEffects([...content.effects, { id: rowId('effect', content.effects), description: '', severity: null, currentControls: '' }]);
  const addCause = () =>
    setCauses([...content.causes, { id: rowId('cause', content.causes), description: '', occurrence: null, detection: null, detectionControl: null, recommendedActions: [] }]);
  return (
    <div className="space-y-4" data-testid="fmea-tool">
      <div className="space-y-1">
        <Label htmlFor="fmea-mode">Failure mode</Label>
        <Input id="fmea-mode" value={content.failureMode} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, failureMode: e.target.value })} />
      </div>
      <h4 className="text-sm font-semibold">Effects (severity 1–10; the worst one counts)</h4>
      <ul className="space-y-2">
        {content.effects.map((effect, index) => (
          <EffectRow key={effect.id} item={effect} index={index} readOnly={readOnly} onChange={(next) => setEffects(replaced(content.effects, next))} onRemove={() => setEffects(without(content.effects, effect.id))} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={addEffect}>
          Add effect
        </Button>
      )}
      <h4 className="text-sm font-semibold">Causes (occurrence and detection 1–10, detection by the cause's own control)</h4>
      <p className="text-xs text-muted-foreground" data-testid="fmea-rules">
        {rulesText(record)}
      </p>
      <ul className="space-y-2">
        {content.causes.map((cause, index) => (
          <CauseRow
            key={cause.id}
            item={cause}
            index={index}
            score={scored(cause.id)}
            readOnly={readOnly}
            onChange={(next) => setCauses(replaced(content.causes, next))}
            onRemove={() => setCauses(without(content.causes, cause.id))}
          />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={addCause}>
          Add cause
        </Button>
      )}
      <SaveBar
        onSave={() => save(content)}
        disabled={content.failureMode.trim() === '' || content.effects.length === 0 || content.causes.length === 0}
        hint="Name the failure mode and add an effect and a cause; ratings may be filled in later."
        label="Save FMEA"
        updatedAt={record?.updatedAt}
      />
    </div>
  );
}

/** FMEA: effects and causes of a failure mode, scored by the server with the RCA policy's rules. */
export function FmeaTool() {
  return <ToolFrame tool="fmea">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
