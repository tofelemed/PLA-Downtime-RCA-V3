import type { ReactNode } from 'react';
import type { DeclaredFigures } from '@/api/v2/types/events';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { planText } from '../model/production-loss';

function Fact({ term, children, testId }: { term: string; children: ReactNode; testId: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

/**
 * Declared mode: the figures OT declared for a production loss day (tonnes in the event's unit), the measurement
 * quality, the OT status and the OT plan they were declared against. Rows of the summary's `dl`.
 */
export function DeclaredSummary({ figures }: { figures: DeclaredFigures }) {
  const { decimal } = useNumberFormat();
  const tonnes = (value: number | null) => (value === null ? '—' : `${decimal(String(value), 3)} ${figures.uom}`);
  const plan = figures.plan ? planText(figures.plan) : '';
  return (
    <>
      <Fact term="Planned" testId="declared-planned">{tonnes(figures.planned)}</Fact>
      <Fact term="Actual" testId="declared-actual">{tonnes(figures.actual)}</Fact>
      <Fact term="Shortfall" testId="declared-shortfall">{tonnes(figures.shortfall)}</Fact>
      <Fact term="Measurement quality" testId="declared-quality">{figures.measurementQuality ?? '—'}</Fact>
      <Fact term="OT status" testId="declared-status">{figures.sourceStatus ?? '—'}</Fact>
      {plan && <Fact term="OT plan" testId="declared-plan">{plan}</Fact>}
    </>
  );
}
