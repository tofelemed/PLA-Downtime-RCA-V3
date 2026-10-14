import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';

const VARIANTS: Readonly<Record<string, 'default' | 'destructive' | 'secondary'>> = {
  effective: 'default',
  not_effective: 'destructive',
  insufficient_evidence: 'secondary',
};

const percent = (share: string | null) => (share === null ? null : `${formatDecimal(String(Number(share) * 100), 0)} %`);

/** The server's CA2 verdict of a verified action with its rates per 1,000 run hours and its reasons. */
export function ActionVerdict({ action }: { action: RcaActionView }) {
  const result = action.postAction?.effectiveness;
  if (!action.verdict) return null;
  const reduction = percent(result?.reduction ?? null);
  return (
    <div className="space-y-1 text-sm" data-testid="action-verdict">
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant={VARIANTS[action.verdict] ?? 'secondary'} data-testid="verdict-badge">
          {labelOf(RCA_VERDICT_LABELS, action.verdict)}
        </Badge>
        {result && (
          <span className="text-muted-foreground">
            same-mode rate {formatDecimal(result.baselineRate, 2)} → {formatDecimal(result.postRate, 2)} per 1,000 run hours
            {reduction ? ` (reduction ${reduction})` : ''}
            {result.mtbfLowerBound95Hours ? ` · MTBF at least ${formatDecimal(result.mtbfLowerBound95Hours, 0)} h (95 %)` : ''}
          </span>
        )}
      </p>
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
