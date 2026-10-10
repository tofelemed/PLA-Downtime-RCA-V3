import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { adminRefusalOf } from '../model/admin-refusal';

/** A refused command with HTTP status, code, field errors, reference counts and correlation id. */
export function AdminRefusalAlert({ error }: { error: unknown }) {
  const refusal = adminRefusalOf(error);
  if (!refusal) return null;
  const Icon = refusal.kind === 'role' || refusal.kind === 'tenant-scope' || refusal.kind === 'duties' ? Lock : AlertTriangle;
  const counts = refusal.references;
  return (
    <Alert variant="destructive" role="alert" data-testid="admin-refusal" data-kind={refusal.kind} data-code={refusal.code} data-status={refusal.status ?? ''}>
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {refusal.title} ({refusal.status ? `${refusal.status} ` : ''}
        {refusal.code})
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{refusal.message}</p>
        {counts && (
          <p className="text-xs" data-testid="refusal-references">
            Still referenced by {counts.activeChildren} active child code(s), {counts.events} event(s), {counts.mappingRules} mapping rule(s).
          </p>
        )}
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
