import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { formatRatioPercent } from '../model/display';

export interface ActualsProvenanceProps {
  periodId: string;
  timezone: string;
}

/** Where the actuals come from (ACT, UX05 "inspect actuals provenance"): method, coverage, source segments, exceptions, adjustments. */
export function ActualsProvenance({ periodId, timezone }: ActualsProvenanceProps) {
  const period = useProductionPeriod(periodId);
  const products = useProducts();
  const state = dataStateOf(period);
  if (state !== 'ready' || !period.data) return <DataState state={state} error={period.error} />;
  const productName = (id: string) => flattenPages(products.data?.pages).find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const detail = period.data.data;
  return (
    <details className="rounded-md border p-2 text-sm" data-testid="actuals-provenance">
      <summary className="cursor-pointer font-medium">Actuals provenance</summary>
      {detail.slices.map((slice) => (
        <div key={slice.id} className="mt-2 space-y-1" data-testid="provenance-slice">
          <p className="font-medium">{productName(slice.productId)}</p>
          {slice.actuals ? (
            <>
              <p>
                Good <Quantity value={slice.actuals.good} uom={slice.actuals.uom} /> · gross <Quantity value={slice.actuals.gross} uom={slice.actuals.uom} /> · method {slice.actuals.method ?? '—'} · coverage{' '}
                {formatRatioPercent(slice.actuals.coverageRatio)} · quality {slice.actuals.qualityState}
              </p>
              <ul className="list-disc pl-5 text-xs">
                {slice.actuals.sourceSegments.map((s) => (
                  <li key={`${s.source}-${s.from}`}>
                    {s.source} ({s.method}, {s.quality}): <PlantTime iso={s.from} tz={timezone} /> → <PlantTime iso={s.to} tz={timezone} /> · <Quantity value={s.quantity} uom={slice.actuals?.uom} />
                  </li>
                ))}
                {slice.actuals.exceptions.map((e) => (
                  <li key={`${e.code}-${e.from ?? ''}`} className={e.severity === 'problem' ? 'text-destructive' : undefined}>
                    {e.severity}: {e.code}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground">No actuals computed for this slice.</p>
          )}
        </div>
      ))}
      {detail.adjustments.length > 0 && (
        <p className="mt-2 text-xs">
          Adjustments: {detail.adjustments.map((a) => `${a.kind} ${a.quantity ?? '—'} ${a.uom ?? ''} (${a.state})`).join('; ')}
        </p>
      )}
    </details>
  );
}
