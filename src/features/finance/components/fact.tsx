import type { ReactNode } from 'react';

/** One labelled value of a record page (inside a `<dl>`). */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
