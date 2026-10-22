import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SaveFailureFrameProps {
  /** the refused save; null / undefined renders nothing */
  failure: unknown;
  className?: string;
  /** the red alert that explains the failure */
  children: ReactNode;
}

/**
 * The frame of every refused-save alert (DECISIONS 2026-10-22 "Save feedback"): scrolls into view and takes
 * focus each time a new failure arrives, and carries the `save-failure-alert` test id. `SaveFailureAlert`
 * puts the kit's alert inside; areas with a richer alert of their own (reference counts, conflicting
 * versions, "Reload") put theirs inside instead.
 *
 * @example
 * <SaveFailureFrame failure={error}><RefusalNotice error={error} timezone={tz} /></SaveFailureFrame>
 */
export function SaveFailureFrame({ failure, className, children }: SaveFailureFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = failure !== null && failure !== undefined;
  useEffect(() => {
    if (!shown || !ref.current) return;
    ref.current.scrollIntoView?.({ block: 'nearest' });
    ref.current.focus({ preventScroll: true });
  }, [failure, shown]);
  if (!shown) return null;
  return (
    <div ref={ref} tabIndex={-1} className={cn('outline-none', className)} data-testid="save-failure-alert">
      {children}
    </div>
  );
}
