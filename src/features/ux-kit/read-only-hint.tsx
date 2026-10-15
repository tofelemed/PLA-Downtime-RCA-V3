import { ActionIcon } from '@/lib/icons';
import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * Small "Read-only" note shown where a toolbar of write controls would be, for users whose roles in the
 * selected plant are all read-only (viewer). Renders nothing for anyone else.
 */
export function ReadOnlyHint({ className = '' }: { className?: string }) {
  const { isReadOnly } = useCapabilities();
  if (!isReadOnly) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground ${className}`}
      data-testid="read-only-hint"
      title="Your role in this plant can view but not change data"
    >
      <ActionIcon.view className="h-3 w-3" aria-hidden />
      Read-only
    </span>
  );
}
