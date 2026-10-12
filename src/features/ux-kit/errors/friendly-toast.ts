import { describeError } from './describe-error';

/**
 * `toast({ ...friendlyToastContent(error), variant: 'destructive' })` for screens on `@/hooks/use-toast`:
 * the plain title and message of `describeError`, never the code or the raw server text.
 */
export function friendlyToastContent(error: unknown): { title: string; description: string } {
  const friendly = describeError(error);
  const firstField = friendly.fieldMessages[0];
  const fieldNote = firstField ? ` ${firstField.label}: ${firstField.message.replace(/\.$/, '')}.` : '';
  return { title: friendly.title, description: `${friendly.message}${fieldNote}`.trim() };
}
