import type { ReactNode } from 'react';

/** Ids of the hint and error lines under a field (`<id>-hint`, `<id>-error`). */
export const fieldHintId = (id: string): string => `${id}-hint`;
export const fieldErrorId = (id: string): string => `${id}-error`;

/** `aria-describedby` for the messages actually shown: the error replaces the hint. */
export function fieldDescribedBy(id: string, messages: { hint?: ReactNode; error?: string | null }): string | undefined {
  if (messages.error) return fieldErrorId(id);
  return messages.hint ? fieldHintId(id) : undefined;
}
