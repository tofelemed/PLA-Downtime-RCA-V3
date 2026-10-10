import { useActualsQuality } from '@/api/v2/queries/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { qualityQuery, type AnalyticsScope } from '../model/analytics-scope';

const STATE_LABELS: Record<string, string> = { complete: 'Complete', partial: 'Partial', missing: 'Missing', conflict: 'Conflict' };

/**
 * Actuals quality coverage (AN02): per product slice behind the shown runs the actuals quality state and
 * coverage band, the lowest coverage, and measured vs estimated output per unit of measure — the server's
 * counts and sums of the stored actuals results.
 */
export function QualityTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useActualsQuality(qualityQuery(scope), env.timezone);
  const data = query.data?.data;
  return (
    <ReportCard title="Actuals quality coverage" testId="pla-quality" query={query} response={query.data} isEmpty={data?.periods === 0} emptyText="No production periods in this scope.">
      {data && (
        <div className="space-y-3 text-sm" data-testid="quality-coverage" data-slices={data.slices} data-lowest={data.lowestCoverage ?? ''}>
          <p>
            {data.slices} product slices with actuals in {data.periods} periods · {data.periodsWithoutActuals} periods without actuals · lowest coverage{' '}
            <strong>{formatRatio(data.lowestCoverage, 0)}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 text-muted-foreground">Quality state</span>
            {data.qualityStates.map((s) => (
              <Badge key={s.state} variant={s.slices > 0 && s.state !== 'complete' ? 'secondary' : 'outline'} data-testid="quality-state" data-key={s.state} data-count={s.slices}>
                {STATE_LABELS[s.state] ?? s.state}: {s.slices}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 text-muted-foreground">Coverage</span>
            {data.coverage.map((c) => (
              <Badge key={c.key} variant="outline" data-testid="coverage-band" data-key={c.key} data-count={c.slices}>
                {c.label}: {c.slices}
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
    </ReportCard>
  );
}
