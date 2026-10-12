import { FriendlyErrorAlert } from '@/features/ux-kit/errors';

/**
 * A refused command in plain language: what happened, what to do, field messages and "Copy support
 * reference" (the server code and correlation id are never shown as text).
 */
export function CommandError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" data-testid="command-error">
      <FriendlyErrorAlert error={error} />
    </div>
  );
}
