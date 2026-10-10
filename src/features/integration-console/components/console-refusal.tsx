import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { refusalOf } from '../model/refusal';

/** A refused command with its code, field errors and the correlation id for support (plan 3.7). */
export function ConsoleRefusal({ error }: { error: unknown }) {
  const refusal = refusalOf(error);
  if (!refusal) return null;
  const Icon = refusal.kind === 'role' ? Lock : AlertTriangle;
  return (
    <Alert variant="destructive" role="alert" data-testid="refusal" data-kind={refusal.kind} data-code={refusal.code}>
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {refusal.title} ({refusal.code})
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{refusal.message}</p>
        {refusal.fieldErrors.map((line) => (
          <p key={line} className="text-xs">
            {line}
          </p>
        ))}
        {refusal.correlationId && <p className="text-xs">Reference: {refusal.correlationId}</p>}
      </AlertDescription>
    </Alert>
  );
}
