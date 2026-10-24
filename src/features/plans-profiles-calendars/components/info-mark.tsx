import type { ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

export interface InfoMarkProps {
  /** names the ⓘ ("About …") */
  label: string;
  text: ReactNode;
  testId?: string;
  /** extra `data-*` attributes of the wrapper (e.g. `data-decision`) */
  data?: Readonly<Record<`data-${string}`, string>>;
}

/** An ⓘ beside a page title that replaces a banner or paragraph; the wrapper keeps the old test id. */
export function InfoMark({ label, text, testId, data }: InfoMarkProps) {
  return (
    <span className="inline-flex items-center" data-testid={testId} {...data}>
      <KpiInfo label={label} text={text} />
    </span>
  );
}
