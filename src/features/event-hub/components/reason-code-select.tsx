import { Label } from '@/components/ui/label';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ReasonCodeSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** allow "no reason" (clears the code on edit) */
  allowEmpty?: boolean;
}

/**
 * Reason code tree picker: the library's codes in path order, indented by level (plan 1.3 code tree).
 * A native select keeps it keyboard and touch friendly on tablets (UX07).
 */
export function ReasonCodeSelect({ id, value, onChange, error, allowEmpty = true }: ReasonCodeSelectProps) {
  const { reasonCodes } = useEventHubEnv();
  const ordered = [...reasonCodes].sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Reason code</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {allowEmpty && <option value="">— none —</option>}
        {ordered.map((code) => (
          <option key={code.id} value={code.id}>
            {`${'  '.repeat(Math.max(0, code.level - 1))}${code.code} · ${code.name}`}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
