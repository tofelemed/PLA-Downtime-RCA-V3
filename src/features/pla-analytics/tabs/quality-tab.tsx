import { useActualsQuality } from '@/api/v2/queries/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { labelOf } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { AnalyticsCard } from '../components/analytics-card';
import { qualityQuery, type AnalyticsScope } from '../model/analytics-scope';
import { QUALITY_STATE_LABELS } from '../model/display';

/**
 * Actuals quality coverage (AN02): per product slice behind the shown runs the actuals quality state and
 * coverage band, the lowest coverage, and measured vs estimated output per unit of measure — the server's
 * counts and sums of the stored actuals results.
 */
export function QualityTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useActualsQuality(qualityQuery(scope), env.timezone);
  const data = query.data?.data;
  const { digits, number, text } = useNumberFormat();
  return (
    <AnalyticsCard title="Actuals quality coverage" testId="pla-quality" query={query} response={query.data} isEmpty={data?.periods === 0} emptyText="No production periods in this scope.">
      {data && (
        <div className="space-y-3 text-sm" data-testid="quality-coverage" data-slices={data.slices} data-lowest={data.lowestCoverage ?? ''}>
          <p>
            {number(data.slices)} product slices with actuals in {number(data.periods)} periods · {number(data.periodsWithoutActuals)} periods without actuals · lowest coverage{' '}
            <strong>{formatRatio(data.lowestCoverage, 0, digits)}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 text-muted-foreground">Quality state</span>
            {data.qualityStates.map((s) => (
              <Badge key={s.state} variant={s.slices > 0 && s.state !== 'complete' ? 'secondary' : 'outline'} data-testid="quality-state" data-key={s.state} data-count={s.slices}>
                {labelOf(QUALITY_STATE_LABELS, s.state)}: {number(s.slices)}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 text-muted-foreground">Coverage</span>
            {data.coverage.map((c) => (
              <Badge key={c.key} variant="outline" data-testid="coverage-band" data-key={c.key} data-count={c.slices}>
                {text(c.label)}: {number(c.slices)}
              </Badge>
            ))}
          </div>
          {data.quantities.map((q) => (
            <p key={q.uom ?? '-'}>
              Measured <Quantity value={q.measured} uom={q.uom} /> · estimated <Quantity value={q.estimated} uom={q.uom} />
            </p>
          ))}
        </div>
      )}
    </AnalyticsCard>
  );
}
