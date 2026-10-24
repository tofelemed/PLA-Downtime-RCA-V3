import type { ReactNode } from 'react';

/** The field alone, or the field and `trailing` (e.g. a calendar button) on one line. */
export function WithTrailing({ trailing, children }: { trailing?: ReactNode; children: ReactNode }) {
  if (!trailing) return <>{children}</>;
  return (
    <div className="flex items-center gap-1">
      {children}
      {trailing}
    </div>
  );
}
