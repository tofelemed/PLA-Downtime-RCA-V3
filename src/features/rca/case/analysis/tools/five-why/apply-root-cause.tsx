import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';

export interface ApplyRootCauseProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** the case's root cause as saved now */
  current: string | null;
  /** why the root-cause update failed after the 5-Why itself was saved */
  error: unknown;
}

/** The opt-in copy of the 5-Why root cause to the case, with the case's current value beside it. */
export function ApplyRootCause({ checked, onChange, current, error }: ApplyRootCauseProps) {
  const saved = current?.trim();
  return (
    <div className="space-y-2" data-testid="apply-root-cause">
      <div className="flex items-center gap-2">
        <Checkbox id="why-apply" checked={checked} onCheckedChange={(value) => onChange(value === true)} />
        <Label htmlFor="why-apply">Also set it as the investigation's root cause</Label>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="current-root-cause">
        {saved ? `Investigation root cause now: "${saved}". Checking the box replaces it.` : 'The investigation has no root cause yet.'}
      </p>
      {error ? (
        <div className="space-y-1" data-testid="root-cause-error">
          <p className="text-sm font-medium">The 5-Why was saved, but the investigation's root cause was not updated.</p>
          <FriendlyErrorAlert error={error} />
        </div>
      ) : null}
    </div>
  );
}
