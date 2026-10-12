import { useState } from 'react';
import type { FmeaCause, FmeaContent, FmeaEffect } from '@/api/v2/types/rca-analyses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { ANALYSIS_SETTINGS, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';

const SCORES = Array.from({ length: 10 }, (_, i) => String(i + 1));

function Score({ id, label, value, disabled, onChange }: { id: string; label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={String(value)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
        {SCORES.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </div>
  );
}

function EffectRow({ effect, index, readOnly, onChange, onRemove }: { effect: FmeaEffect; index: number; readOnly: boolean; onChange: (next: FmeaEffect) => void; onRemove: () => void }) {
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
      <div className="space-y-1">
        <Label htmlFor={`effect-${index}`}>Effect {index + 1}</Label>
        <Input id={`effect-${index}`} value={effect.description} maxLength={2000} disabled={readOnly} onChange={(e) => onChange({ ...effect, description: e.target.value })} />
      </div>
      <Score id={`effect-severity-${index}`} label="Severity" value={effect.severity} disabled={readOnly} onChange={(severity) => onChange({ ...effect, severity })} />
      <Score id={`effect-detection-${index}`} label="Detection" value={effect.detection} disabled={readOnly} onChange={(detection) => onChange({ ...effect, detection })} />
      <div className="space-y-1">
        <Label htmlFor={`effect-controls-${index}`}>Current controls</Label>
        <Input id={`effect-controls-${index}`} value={effect.currentControls} maxLength={1000} disabled={readOnly} onChange={(e) => onChange({ ...effect, currentControls: e.target.value })} />
      </div>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove effect ${index + 1}`} className="self-end" onClick={onRemove} />}
    </li>
  );
}

function CauseRow(props: { cause: FmeaCause; index: number; rpn: number | null; readOnly: boolean; onChange: (next: FmeaCause) => void; onRemove: () => void }) {
  const { cause, index, rpn, readOnly } = props;
  const high = rpn !== null && rpn >= ANALYSIS_SETTINGS.fmea.riskThreshold;
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-[2fr_1fr_2fr_auto_auto]">
      <div className="space-y-1">
        <Label htmlFor={`cause-${index}`}>Cause {index + 1}</Label>
        <Input id={`cause-${index}`} value={cause.description} maxLength={2000} disabled={readOnly} onChange={(e) => props.onChange({ ...cause, description: e.target.value })} />
      </div>
      <Score id={`cause-occurrence-${index}`} label="Occurrence" value={cause.occurrence} disabled={readOnly} onChange={(occurrence) => props.onChange({ ...cause, occurrence })} />
      <div className="space-y-1">
        <Label htmlFor={`cause-actions-${index}`}>Recommended actions (separate with ;)</Label>
        <Input
          id={`cause-actions-${index}`}
          value={cause.recommendedActions.join('; ')}
          disabled={readOnly}
          onChange={(e) => props.onChange({ ...cause, recommendedActions: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
      <Badge variant={high ? 'destructive' : 'outline'} className="self-end" title="Risk priority number, calculated when saved">
        {rpn === null ? 'RPN after save' : `RPN ${rpn}${high ? ' (above threshold)' : ''}`}
      </Badge>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove cause ${index + 1}`} className="self-end" onClick={props.onRemove} />}
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'fmea'>; save: (body: FmeaContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useState<FmeaContent>(() => ({ failureMode: record?.failureMode ?? rca.title.slice(0, 255), effects: record?.effects ?? [], causes: record?.causes.map(({ rpn: _rpn, ...cause }) => cause) ?? [] }));
  const rpnOf = (id: string) => record?.causes.find((cause) => cause.id === id)?.rpn ?? null;
  const setEffects = (effects: FmeaEffect[]) => setContent({ ...content, effects });
  const setCauses = (causes: FmeaCause[]) => setContent({ ...content, causes });
  return (
    <div className="space-y-4" data-testid="fmea-tool">
      <div className="space-y-1">
        <Label htmlFor="fmea-mode">Failure mode</Label>
        <Input id="fmea-mode" value={content.failureMode} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, failureMode: e.target.value })} />
      </div>
      <h4 className="text-sm font-semibold">Effects (severity and detection 1–10)</h4>
      <ul className="space-y-2">
        {content.effects.map((effect, index) => (
          <EffectRow key={effect.id} effect={effect} index={index} readOnly={readOnly} onChange={(next) => setEffects(content.effects.map((e) => (e.id === next.id ? next : e)))} onRemove={() => setEffects(content.effects.filter((e) => e.id !== effect.id))} />
        ))}
      </ul>
      {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => setEffects([...content.effects, { id: rowId('effect', content.effects), description: '', severity: 5, currentControls: '', detection: 5 }])}>Add effect</Button>}
      <h4 className="text-sm font-semibold">Causes (occurrence 1–10; RPN = worst severity × occurrence × worst detection, threshold {ANALYSIS_SETTINGS.fmea.riskThreshold})</h4>
      <ul className="space-y-2">
        {content.causes.map((cause, index) => (
          <CauseRow key={cause.id} cause={cause} index={index} rpn={rpnOf(cause.id)} readOnly={readOnly} onChange={(next) => setCauses(content.causes.map((c) => (c.id === next.id ? next : c)))} onRemove={() => setCauses(content.causes.filter((c) => c.id !== cause.id))} />
        ))}
      </ul>
      {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => setCauses([...content.causes, { id: rowId('cause', content.causes), description: '', occurrence: 5, recommendedActions: [] }])}>Add cause</Button>}
      <SaveBar onSave={() => save(content)} disabled={content.failureMode.trim() === '' || content.effects.length === 0 || content.causes.length === 0} hint="Name the failure mode and add an effect and a cause." label="Save FMEA" updatedAt={record?.updatedAt} />
    </div>
  );
}

/** FMEA: effects and causes of a failure mode, ranked by the risk priority number the server computes. */
export function FmeaTool() {
  return <ToolFrame tool="fmea">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
