import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { describeError, FieldMessageList, SupportReference } from '@/features/ux-kit/errors';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusIcon } from '@/lib/icons';
import { refusalOf } from '../model/refusal';

export interface RefusalNoticeProps {
  error: unknown;
  timezone: string;
  /** what to do after a 412, e.g. reload the version */
  onReload?: () => void;
}

/**
 * A refused command in plain language (plan 3.4): what was refused and why, the conflicting versions of
 * an overlap with their intervals, field messages and a reload after a stale edit. The server code and
 * the correlation id stay behind "Copy support reference" (`data-code` is for tests only).
 */
export function RefusalNotice({ error, timezone, onReload }: RefusalNoticeProps) {
  const refusal = refusalOf(error);
  if (!refusal) return null;
  const friendly = describeError(error);
  const Icon = refusal.kind === 'role' || refusal.kind === 'scope' || refusal.kind === 'duties' ? StatusIcon.locked : StatusIcon.warning;
  return (
    <Alert variant="destructive" role="alert" data-testid="refusal" data-kind={refusal.kind} data-code={refusal.code}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{refusal.title}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{friendly.message}</p>
        {refusal.conflicts.length > 0 && (
          <ul className="list-disc pl-5 text-sm" data-testid="refusal-conflicts">
            {refusal.conflicts.map((conflict, index) => (
              <li key={`${conflict.id ?? index}-${conflict.label}`} data-testid="refusal-conflict">
                {conflict.label}: <PlantTime iso={conflict.from} tz={timezone} withDate /> →{' '}
                {conflict.to ? <PlantTime iso={conflict.to} tz={timezone} withDate /> : 'open-ended'}
              </li>
            ))}
          </ul>
        )}
        <FieldMessageList fieldMessages={friendly.fieldMessages} />
        {refusal.kind === 'stale' && onReload && (
          <button type="button" className="text-sm underline" onClick={onReload}>
            Reload the latest version
          </button>
        )}
        <SupportReference reference={friendly.reference} />
      </AlertDescription>
    </Alert>
  );
}
