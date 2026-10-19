import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';

/**
 * Why the Event Hub offers no New event, Code, Split, Merge or Bulk code: a read-only role, or a role that may
 * write elsewhere but reads events only (owner decision 2026-10-19: the production accountant has read-only coding).
 */
export function EventsReadOnlyHint() {
  const { isReadOnly } = useCapabilities();
  if (isReadOnly) return <ReadOnlyHint />;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
      data-testid="events-read-only-hint"
      title="Stops are recorded and coded by operators, production engineers, reliability engineers and manager approvers"
    >
      <ActionIcon.view className="h-3 w-3" aria-hidden />
      Events: read-only for your role
    </span>
  );
}
