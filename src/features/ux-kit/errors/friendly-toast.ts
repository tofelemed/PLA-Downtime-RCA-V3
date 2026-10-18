import { describeError } from './describe-error';
import type { FieldVocabulary } from './field-vocabulary';

/** Field notes a toast lists before "and N more" (the rest is on the form or behind the support reference). */
const TOAST_FIELD_LIMIT = 3;

/**
 * `toast({ ...friendlyToastContent(error), variant: 'destructive' })` for screens on `@/hooks/use-toast`:
 * the plain title and message of `describeError` plus the refused fields by name ("Valid from: Must be a
 * date.", "Unexpected field: xyz."), never the code or the raw server text.
 */
export function friendlyToastContent(error: unknown, fields?: FieldVocabulary): { title: string; description: string } {
  const friendly = describeError(error, undefined, fields);
  const notes = friendly.fieldMessages.slice(0, TOAST_FIELD_LIMIT).map((entry) => `${entry.label}: ${entry.message.replace(/\.$/, '')}.`);
  const more = friendly.fieldMessages.length - TOAST_FIELD_LIMIT;
  if (more > 0) notes.push(`And ${more} more.`);
  return { title: friendly.title, description: [friendly.message, ...notes].join(' ').trim() };
}
