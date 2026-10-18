import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SourceOverrides } from '../hooks/use-source-overrides';
import { OVERRIDABLE_FORM_FIELDS, ownedFieldsOf } from '../model/source-ownership';

export interface SourceOwnedFieldProps {
  /** PATCH / form field names of the wrapped inputs */
  fields: readonly string[];
  overrides: SourceOverrides;
  /** grid placement of the wrapper (e.g. `sm:col-span-2` for a field group) */
  className?: string;
  /** where the value comes from, when more precise than "From <source>" (e.g. the approved impact rule) */
  origin?: string | null;
  children: ReactNode;
}

/**
 * E-5: inputs of fields the source owns, marked "From <source>" and locked until the user chooses
 * "Override…" — then the change is stated to be recorded as an override of the source value (the server
 * records it so). Fields the source does not own render unchanged.
 */
export function SourceOwnedField({ fields, overrides, className, origin, children }: SourceOwnedFieldProps) {
  const owned = ownedFieldsOf(overrides, fields);
  if (owned.length === 0) return <>{children}</>;
  const unlocked = overrides.isUnlocked(owned);
  const names = owned.map((field) => OVERRIDABLE_FORM_FIELDS[field] ?? field).join(', ');
  return (
    <div className={cn('space-y-1', className)} data-testid={`source-owned-${owned[0]}`} data-unlocked={unlocked}>
      <fieldset disabled={!unlocked} className="contents">
        {children}
      </fieldset>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:col-span-2" data-testid="source-owned-hint">
        <span>
          {origin ?? `From ${overrides.source}`} ({names})
          {unlocked ? ' · your change is recorded as an override of the source value.' : ''}
        </span>
        {!unlocked && (
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => overrides.unlock(owned)} data-testid="source-override">
            Override…
          </Button>
        )}
      </p>
    </div>
  );
}
