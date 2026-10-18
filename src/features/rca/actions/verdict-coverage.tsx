import type { RcaEffectivenessCoverage } from '@/api/v2/types/rca-workflow';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/**
 * Owner, 18 Oct 2026: the state-data coverage the server reported with a verdict — the window after the
 * action against the policy minimum, and the baseline window (reported, not gated). Nothing for verdicts
 * stored before the coverage was recorded.
 */
export function VerdictCoverage({ coverage }: { coverage: RcaEffectivenessCoverage | undefined }) {
  const { percent } = useNumberFormat();
  if (!coverage) return null;
  const share = (value: string) => percent(Number(value) * 100, 1);
  const parts = [
    coverage.post === null ? null : `after the action ${share(coverage.post)} (minimum ${share(coverage.minimum)})`,
    coverage.baseline === null ? null : `baseline ${share(coverage.baseline)}`,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return (
    <p className="text-muted-foreground" data-testid="verdict-coverage">
      State-data coverage: {parts.join(' · ')}
    </p>
  );
}
