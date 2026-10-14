import type { FmeaCause, FmeaEffect } from '@/api/v2/types/rca-analyses';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import type { CauseScore } from './fmea-model';

const SCORES = Array.from({ length: 10 }, (_, i) => String(i + 1));

/** A 1–10 rating; empty stays empty ("Not rated"), never a neutral default. */
function Score({ id, label, value, disabled, onChange }: { id: string; label: string; value: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded border bg-background px-2 text-sm"
        value={value === null ? '' : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">Not rated</option>
        {SCORES.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RowProps<T> {
  item: T;
  index: number;
  readOnly: boolean;
  onChange: (next: T) => void;
  onRemove: () => void;
}

export function EffectRow({ item: effect, index, readOnly, onChange, onRemove }: RowProps<FmeaEffect>) {
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-[2fr_1fr_2fr_auto]">
      <div className="space-y-1">
        <Label htmlFor={`effect-${index}`}>Effect {index + 1}</Label>
        <Input id={`effect-${index}`} value={effect.description} maxLength={2000} disabled={readOnly} onChange={(e) => onChange({ ...effect, description: e.target.value })} />
      </div>
      <Score id={`effect-severity-${index}`} label="Severity" value={effect.severity} disabled={readOnly} onChange={(severity) => onChange({ ...effect, severity })} />
      <div className="space-y-1">
        <Label htmlFor={`effect-controls-${index}`}>Current controls</Label>
        <Input id={`effect-controls-${index}`} value={effect.currentControls} maxLength={1000} disabled={readOnly} onChange={(e) => onChange({ ...effect, currentControls: e.target.value })} />
      </div>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove effect ${index + 1}`} className="self-end" onClick={onRemove} />}
    </li>
  );
}

const splitActions = (text: string) => text.split(';').map((s) => s.trim()).filter(Boolean);

export function CauseRow({ item: cause, index, readOnly, onChange, onRemove, score }: RowProps<FmeaCause> & { score: CauseScore | null }) {
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-[2fr_1fr_1fr_2fr]" data-testid="fmea-cause">
      <div className="space-y-1">
        <Label htmlFor={`cause-${index}`}>Cause {index + 1}</Label>
        <Input id={`cause-${index}`} value={cause.description} maxLength={2000} disabled={readOnly} onChange={(e) => onChange({ ...cause, description: e.target.value })} />
      </div>
      <Score id={`cause-occurrence-${index}`} label="Occurrence" value={cause.occurrence} disabled={readOnly} onChange={(occurrence) => onChange({ ...cause, occurrence })} />
      <Score id={`cause-detection-${index}`} label="Detection" value={cause.detection} disabled={readOnly} onChange={(detection) => onChange({ ...cause, detection })} />
      <div className="space-y-1">
        <Label htmlFor={`cause-control-${index}`}>Detection control</Label>
        <Input
          id={`cause-control-${index}`}
          value={cause.detectionControl ?? ''}
          maxLength={1000}
          disabled={readOnly}
          onChange={(e) => onChange({ ...cause, detectionControl: e.target.value.trim() === '' ? null : e.target.value })}
        />
      </div>
      <div className="space-y-1 md:col-span-3">
        <Label htmlFor={`cause-actions-${index}`}>Recommended actions (separate with ;)</Label>
        <Input id={`cause-actions-${index}`} value={cause.recommendedActions.join('; ')} disabled={readOnly} onChange={(e) => onChange({ ...cause, recommendedActions: splitActions(e.target.value) })} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <Badge variant={score?.alert ? 'destructive' : 'outline'} title="Computed by the server when saved" data-testid="fmea-score">
          {score ? score.text : 'Scored after save'}
        </Badge>
        {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove cause ${index + 1}`} onClick={onRemove} />}
      </div>
    </li>
  );
}
