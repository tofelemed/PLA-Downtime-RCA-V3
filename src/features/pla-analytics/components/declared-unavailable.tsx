import { DECLARED_NOT_AVAILABLE } from '../model/declared-access';

/** Shown instead of a capacity-based report when the plant accounts declared losses. */
export function DeclaredUnavailable() {
  return (
    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="declared-unavailable" role="status">
      {DECLARED_NOT_AVAILABLE}
    </p>
  );
}
