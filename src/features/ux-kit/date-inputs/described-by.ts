/** Ids and texts of the hint and error under a date field (wired to `aria-describedby`). */
export interface FieldMessagesProps {
  hintId: string;
  hint?: string | null;
  errorId: string;
  error?: string | null;
}

/** `aria-describedby` value for the messages that are actually shown (undefined when none). */
export function describedBy({ hintId, hint, errorId, error }: FieldMessagesProps): string | undefined {
  const ids = [error ? errorId : null, hint ? hintId : null].filter((id): id is string => id !== null);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
