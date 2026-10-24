import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

export interface FigureStatusProps {
  /** the server's `isProvisional` of the figures */
  provisional: boolean;
  /** runs, coverage and as-of behind the ⓘ */
  info: ReactNode;
  testId: string;
  /** extra data attributes of the wrapper (e.g. the run ids) */
  data?: Readonly<Record<`data-${string}`, string | number>>;
}

/**
 * The one approval label of a set of figures: "Provisional" while any period is not approved (owner rule:
 * draft and approved figures never mix without a label), else "Approved"; what they stand on is the ⓘ.
 */
export function FigureStatus({ provisional, info, testId, data }: FigureStatusProps) {
  const text = provisional ? 'Provisional' : 'Approved';
  return (
    <span className="inline-flex items-center gap-1.5" data-testid={testId} {...data}>
      <Badge variant={provisional ? 'secondary' : 'outline'} className="whitespace-nowrap" data-testid="figure-status">
        {text}
      </Badge>
      <KpiInfo label={`${text} figures`} text={info} />
    </span>
  );
}
