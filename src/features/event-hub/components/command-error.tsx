import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { V2ApiError } from '@/api/v2/errors';

/** A refused command: the server's message and code, field errors and the correlation id for support. */
export function CommandError({ error }: { error: unknown }) {
  if (!error) return null;
  const known = error instanceof V2ApiError ? error : null;
  return (
    <Alert variant="destructive" role="alert" data-testid="command-error">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{known ? `Refused (${known.code})` : 'Request failed'}</AlertTitle>
      <AlertDescription>
        <p>{known ? known.message : 'The request did not reach the server. Try again.'}</p>
        {known?.fieldErrors.map((entry) => (
          <p key={`${entry.field}:${entry.message}`} className="text-xs">
            {entry.field}: {entry.message}
          </p>
        ))}
        {known?.correlationId && <p className="mt-1 text-xs">Reference: {known.correlationId}</p>}
      </AlertDescription>
    </Alert>
  );
}
