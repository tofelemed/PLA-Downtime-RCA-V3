import { StatusIcon } from '@/lib/icons';
import type { RuleCheckView, RulesSchemaView } from '@/api/v2/types/rules';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ValidationSummaryProps {
  check: RuleCheckView | undefined;
  checking: boolean;
  /** errors not tied to a row (e.g. "when has 22 conditions") */
  general: string[];
  limits: RulesSchemaView['limits'];
}

/** Live result of `POST /rules/validate` for the current draft (the server's verdict, not the browser's). */
export function ValidationSummary({ check, checking, general, limits }: ValidationSummaryProps) {
  const { number } = useNumberFormat();
  const state = checking ? 'checking' : !check ? 'idle' : check.valid ? 'valid' : 'invalid';
  return (
    <div className="rounded border p-2 text-sm" role="status" aria-live="polite" data-testid="rule-validation" data-state={state}>
      {state === 'checking' && (
        <p className="flex items-center gap-1 text-muted-foreground">
          <StatusIcon.loading className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking with the server…
        </p>
      )}
      {state === 'valid' && (
        <p className="flex items-center gap-1 text-success">
          <StatusIcon.success className="h-4 w-4" aria-hidden="true" /> Valid: {number(check?.conditionCount)} of at most {number(limits.maxConditions)} conditions.
        </p>
      )}
      {state === 'invalid' && (
        <p className="flex items-center gap-1 text-destructive">
          <StatusIcon.error className="h-4 w-4" aria-hidden="true" /> Not valid yet — see the marked rows.
        </p>
      )}
      {general.map((message) => (
        <p key={message} role="alert" className="text-xs text-destructive" data-testid="general-error">
          {message}
        </p>
      ))}
    </div>
  );
}
