import type { ReactNode } from 'react';

export interface CaseColumnsProps {
  /** the page's main content (≈ 2/3 from 1280 px) */
  main: ReactNode;
  /** status, workflow, team… (≈ 1/3 from 1280 px; under the main content below) */
  side: ReactNode;
  testId?: string;
}

/** Two-column layout of a case page at ≥ 1280 px: main content left, a side column right; one column below. */
export function CaseColumns({ main, side, testId }: CaseColumnsProps) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-testid={testId}>
      <div className="min-w-0 space-y-4">{main}</div>
      <aside className="min-w-0 space-y-4">{side}</aside>
    </div>
  );
}
