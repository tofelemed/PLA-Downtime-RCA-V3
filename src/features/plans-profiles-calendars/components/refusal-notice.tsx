import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { refusalOf } from '../model/refusal';

export interface RefusalNoticeProps {
  error: unknown;
  timezone: string;
  /** what to do after a 412, e.g. reload the version */
  onReload?: () => void;
}

/**
 * A refused command shown as the server said it (plan 3.4): role / scope / duties refusals with their
 * code, overlap conflicts with the conflicting versions and intervals, stale edits with a reload, field
 * errors and the correlation id for support.
 */
export function RefusalNotice({ error, timezone, onReload }: RefusalNoticeProps) {
  const refusal = refusalOf(error);
  if (!refusal) return null;
  const Icon = refusal.kind === 'role' || refusal.kind === 'scope' || refusal.kind === 'duties' ? Lock : AlertTriangle;
  return (
    <Alert variant="destructive" role="alert" data-testid="refusal" data-kind={refusal.kind} data-code={refusal.code}>
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {refusal.title} ({refusal.code})
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{refusal.message}</p>
        {refusal.conflicts.length > 0 && (
          <ul className="list-disc pl-5 text-sm" data-testid="refusal-conflicts">
            {refusal.conflicts.map((conflict) => (
              <li key={`${conflict.id}-${conflict.label}`} data-testid="refusal-conflict">
                {conflict.label}: <PlantTime iso={conflict.from} tz={timezone} withDate /> →{' '}
                {conflict.to ? <PlantTime iso={conflict.to} tz={timezone} withDate /> : 'open-ended'}
              </li>
            ))}
          </ul>
        )}
        {Object.entries(refusal.fieldErrors).map(([field, message]) => (
          <p key={field} className="text-xs">
            {field}: {message}
          </p>
        ))}
        {refusal.kind === 'stale' && onReload && (
          <button type="button" className="text-sm underline" onClick={onReload}>
            Reload the latest version
          </button>
        )}
        {refusal.correlationId && <p className="text-xs">Reference: {refusal.correlationId}</p>}
      </AlertDescription>
    </Alert>
  );
}
