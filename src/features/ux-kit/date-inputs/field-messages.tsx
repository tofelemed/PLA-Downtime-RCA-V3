import type { FieldMessagesProps } from './described-by';

/** The muted hint and the destructive error line under a date field. */
export function FieldMessages({ hintId, hint, errorId, error }: FieldMessagesProps) {
  return (
    <>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </>
  );
}
