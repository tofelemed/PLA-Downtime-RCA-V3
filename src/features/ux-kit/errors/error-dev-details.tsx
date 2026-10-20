const isDev = import.meta.env.DEV;

/**
 * The technical message and stack of a crash — development builds only (users never see technical
 * details; production builds drop this block).
 */
export function ErrorDevDetails({ error }: { error: unknown }) {
  if (!isDev) return null;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return (
    <details className="mt-3 text-xs" data-testid="error-dev-details">
      <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Technical details (development only)
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-foreground">
        {message}
        {stack ? `\n\n${stack}` : ''}
      </pre>
    </details>
  );
}
