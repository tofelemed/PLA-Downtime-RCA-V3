import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFlag } from '@/api/v2/queries/feature-flags';

export interface LegacyFieldProps {
  /** what the v1 field is, e.g. "Capacity" */
  label: string;
  /** what replaces it, e.g. "an approved sustained rate on a production profile" */
  replacement: string;
  children: ReactNode;
}

/**
 * A v1 master-data field the v2 calculations never read (plan 3.4 step 4): while
 * `v2.plansProfilesCalendars` is on it is folded under "Legacy" with a migration note and a link to the
 * profiles; with the flag off the v1 form is unchanged (C4).
 */
export function LegacyField({ label, replacement, children }: LegacyFieldProps) {
  const flag = useFlag('v2.plansProfilesCalendars');
  if (!flag.enabled) return <>{children}</>;
  return (
    <details className="rounded-md border border-dashed p-2" data-testid="legacy-field">
      <summary className="cursor-pointer text-sm text-muted-foreground">Legacy (v1): {label} — not used by v2 calculations</summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          Kept for the v1 screens only. Use {replacement} in{' '}
          <Link className="underline" to="/planning?tab=profiles">
            Plans, profiles & calendars
          </Link>
          .
        </p>
        {children}
      </div>
    </details>
  );
}
