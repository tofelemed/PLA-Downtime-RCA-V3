import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { refusalOf } from '../model/refusal';

/**
 * A refused integration command in plain language (role, stale edit, state, validation, source). The
 * server code and correlation id stay behind "Copy support reference"; `data-code` is for tests only.
 */
export function ConsoleRefusal({ error }: { error: unknown }) {
  const refusal = refusalOf(error);
  if (!refusal) return null;
  const title = refusal.kind === 'role' || refusal.kind === 'stale' || refusal.kind === 'unavailable' ? refusal.title : undefined;
  return (
    <div data-testid="refusal" data-kind={refusal.kind} data-code={refusal.code}>
      <FriendlyErrorAlert error={error} title={title} />
    </div>
  );
}
