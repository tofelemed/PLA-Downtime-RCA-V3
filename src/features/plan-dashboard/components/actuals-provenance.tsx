import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { PeriodDetailView } from '@/api/v2/types/periods';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf, useProductNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ACTUALS_METHOD_LABELS, ACTUALS_QUALITY_LABELS, ACTUALS_SOURCE_LABELS, FINDING_LABELS, SEGMENT_QUALITY_LABELS } from '../model/actuals-labels';
import { formatRatioPercent } from '../model/display';

export interface ActualsProvenanceProps {
  periodId: string;
  timezone: string;
}

type DetailSlice = PeriodDetailView['slices'][number];

function SliceProvenance({ slice, timezone, productName }: { slice: DetailSlice; timezone: string; productName: string }) {
  const actuals = slice.actuals;
  return (
    <div className="mt-2 space-y-1" data-testid="provenance-slice">
      <p className="font-medium">{productName}</p>
      {actuals ? (
        <>
          <p>
            Good <Quantity value={actuals.good} uom={actuals.uom} /> · gross <Quantity value={actuals.gross} uom={actuals.uom} /> · from {labelOf(ACTUALS_METHOD_LABELS, actuals.method, 'unknown source')} · coverage{' '}
            {formatRatioPercent(actuals.coverageRatio)} · {labelOf(ACTUALS_QUALITY_LABELS, actuals.qualityState)}
          </p>
          <ul className="list-disc pl-5 text-xs">
            {actuals.sourceSegments.map((s) => (
              <li key={`${s.source}-${s.from}`}>
                {labelOf(ACTUALS_SOURCE_LABELS, s.source)} ({labelOf(ACTUALS_METHOD_LABELS, s.method).toLowerCase()}, {labelOf(SEGMENT_QUALITY_LABELS, s.quality)}): <PlantTime iso={s.from} tz={timezone} /> → <PlantTime iso={s.to} tz={timezone} /> ·{' '}
                <Quantity value={s.quantity} uom={actuals.uom} />
              </li>
            ))}
            {actuals.exceptions.map((e) => (
              <li key={`${e.code}-${e.from ?? ''}`} className={e.severity === 'problem' ? 'text-destructive' : undefined} data-code={e.code}>
                {e.severity === 'problem' ? 'Problem: ' : 'Note: '}
                {labelOf(FINDING_LABELS, e.code)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">No actuals calculated for this product yet.</p>
      )}
    </div>
  );
}

/** Where the actuals come from: method, coverage, source segments and findings, per product of the period. */
export function ActualsProvenance({ periodId, timezone }: ActualsProvenanceProps) {
  const period = useProductionPeriod(periodId);
  const products = useProductNames();
  const state = dataStateOf(period);
  if (state !== 'ready' || !period.data) return <DataState state={state} error={period.error} />;
  return (
    <details className="rounded-md border p-2 text-sm" data-testid="actuals-provenance">
      <summary className="cursor-pointer font-medium">Actuals provenance</summary>
      {period.data.data.slices.map((slice) => (
        <SliceProvenance key={slice.id} slice={slice} timezone={timezone} productName={products.nameOf(slice.productId)} />
      ))}
    </details>
  );
}
