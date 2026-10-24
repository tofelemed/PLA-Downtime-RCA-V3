import type { FmeaCause, FmeaEffect } from '@/api/v2/types/rca-analyses';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { CauseScore } from './fmea-model';

const SCORES = Array.from({ length: 10 }, (_, i) => String(i + 1));
export const CELL = 'px-2 py-1.5 align-top text-sm';
const NUM = 'text-right tabular-nums';

/** Free text of a row: an input named by its column while editable, the words when read-only. */
function TextCell({ label, value, readOnly, maxLength, onChange }: { label: string; value: string; readOnly: boolean; maxLength?: number; onChange: (value: string) => void }) {
  if (readOnly) return <td className={cn(CELL, 'max-w-[40ch] whitespace-pre-wrap break-words')}>{value || <span className="text-muted-foreground">—</span>}</td>;
  return (
    <td className={CELL}>
      <Input aria-label={label} className="h-9 min-w-[10rem]" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </td>
  );
}

/** A 1–10 rating, right-aligned; empty stays empty ("Not rated"), never a neutral default. */
function ScoreCell({ label, value, readOnly, onChange }: { label: string; value: number | null; readOnly: boolean; onChange: (value: number | null) => void }) {
  const { number } = useNumberFormat();
  if (readOnly) return <td className={cn(CELL, NUM)}>{value === null ? <span className="text-muted-foreground">Not rated</span> : number(value)}</td>;
  return (
    <td className={cn(CELL, NUM)}>
      <select aria-label={label} className="h-9 w-20 rounded-md border bg-background px-2 text-right text-sm" value={value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">Not rated</option>
        {SCORES.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </td>
  );
}

interface RowProps<T> {
  item: T;
  index: number;
  readOnly: boolean;
  onChange: (next: T) => void;
  onRemove: () => void;
}

function RemoveCell({ readOnly, label, onRemove }: { readOnly: boolean; label: string; onRemove: () => void }) {
  if (readOnly) return null;
  return (
    <td className={cn(CELL, 'w-10')}>
      <IconButton icon={ActionIcon.delete} label={label} onClick={onRemove} />
    </td>
  );
}

export function EffectRow({ item: effect, index, readOnly, onChange, onRemove }: RowProps<FmeaEffect>) {
  const { number } = useNumberFormat();
  const n = index + 1;
  return (
    <tr className="border-b last:border-0" data-testid="fmea-effect">
      <td className={cn(CELL, NUM, 'w-8 text-muted-foreground')}>{number(n)}</td>
      <TextCell label={`Effect ${n}`} value={effect.description} readOnly={readOnly} maxLength={2000} onChange={(description) => onChange({ ...effect, description })} />
      <ScoreCell label={`Severity of effect ${n}`} value={effect.severity} readOnly={readOnly} onChange={(severity) => onChange({ ...effect, severity })} />
      <TextCell label={`Current controls of effect ${n}`} value={effect.currentControls} readOnly={readOnly} maxLength={1000} onChange={(currentControls) => onChange({ ...effect, currentControls })} />
      <RemoveCell readOnly={readOnly} label={`Remove effect ${n}`} onRemove={onRemove} />
    </tr>
  );
}

const splitActions = (text: string) => text.split(';').map((s) => s.trim()).filter(Boolean);

/** The server's assessment in words first; the warning icon and colour only repeat it. */
function StatusCell({ status }: { status: CauseScore }) {
  const { text } = useNumberFormat();
  return (
    <td className={cn(CELL, 'whitespace-nowrap', status.alert && 'font-medium text-destructive')} title="Computed by the server when saved" data-testid="fmea-score">
      <span className="inline-flex items-center gap-1">
        {status.alert && <StatusIcon.warning aria-hidden="true" className="h-4 w-4" />}
        {text(status.text)}
      </span>
    </td>
  );
}

export function CauseRow({ item: cause, index, readOnly, onChange, onRemove, rpn, status }: RowProps<FmeaCause> & { rpn: string; status: CauseScore }) {
  const { number, text } = useNumberFormat();
  const n = index + 1;
  return (
    <tr className="border-b last:border-0" data-testid="fmea-cause">
      <td className={cn(CELL, NUM, 'w-8 text-muted-foreground')}>{number(n)}</td>
      <TextCell label={`Cause ${n}`} value={cause.description} readOnly={readOnly} maxLength={2000} onChange={(description) => onChange({ ...cause, description })} />
      <ScoreCell label={`Occurrence of cause ${n}`} value={cause.occurrence} readOnly={readOnly} onChange={(occurrence) => onChange({ ...cause, occurrence })} />
      <ScoreCell label={`Detection of cause ${n}`} value={cause.detection} readOnly={readOnly} onChange={(detection) => onChange({ ...cause, detection })} />
      <TextCell
        label={`Detection control of cause ${n}`}
        value={cause.detectionControl ?? ''}
        readOnly={readOnly}
        maxLength={1000}
        onChange={(value) => onChange({ ...cause, detectionControl: value.trim() === '' ? null : value })}
      />
      <TextCell label={`Recommended actions of cause ${n} (separate with ;)`} value={cause.recommendedActions.join('; ')} readOnly={readOnly} onChange={(value) => onChange({ ...cause, recommendedActions: splitActions(value) })} />
      <td className={cn(CELL, NUM, 'font-medium')} data-testid="fmea-rpn">
        {text(rpn)}
      </td>
      <StatusCell status={status} />
      <RemoveCell readOnly={readOnly} label={`Remove cause ${n}`} onRemove={onRemove} />
    </tr>
  );
}
