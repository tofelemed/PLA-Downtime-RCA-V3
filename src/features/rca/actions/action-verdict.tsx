import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { ExposureCoverage } from './exposure-coverage';
import { VerdictCoverage } from './verdict-coverage';

const VARIANTS: Readonly<Record<string, 'default' | 'destructive' | 'secondary'>> = {
  effective: 'default',
  not_effective: 'destructive',
  insufficient_evidence: 'secondary',
};

/** The server's CA2 verdict of a verified action with its rates per 1,000 run hours and its reasons. */
export function ActionVerdict({ action }: { action: RcaActionView }) {
  const result = action.postAction?.effectiveness;
  const { decimal, percent, text } = useNumberFormat();
  if (!action.verdict) return null;
  const share = result?.reduction ?? null;
  const reduction = share === null ? null : percent(Number(share) * 100);
  return (
    <div className="space-y-1 text-sm" data-testid="action-verdict">
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant={VARIANTS[action.verdict] ?? 'secondary'} data-testid="verdict-badge">
          {labelOf(RCA_VERDICT_LABELS, action.verdict)}
        </Badge>
        {result && (
          <span className="text-muted-foreground">
            same-mode rate {decimal(result.baselineRate, 2)} → {decimal(result.postRate, 2)} per {text('1,000')} run hours
            {reduction ? ` (reduction ${reduction})` : ''}
            {result.mtbfLowerBound95Hours ? ` · MTBF at least ${decimal(result.mtbfLowerBound95Hours, 0)} h (${percent(95)})` : ''}
            {action.postAction?.exposure && <ExposureCoverage window={action.postAction.exposure} />}
          </span>
        )}
      </p>
      <VerdictCoverage coverage={result?.coverage} />
      {result && result.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-muted-foreground">
          {result.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
