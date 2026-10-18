import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { PeriodDetailView } from '@/api/v2/types/periods';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf, useProductNames } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useCalendarPreference } from '@/lib/dates';
import { useUnitSignalNames } from '@/api/v2/queries/signals';
import { ACTUALS_METHOD_LABELS, ACTUALS_QUALITY_LABELS, findingText } from '../model/actuals-labels';
import { formatRatioPercent } from '../model/display';
import { QualityClasses } from './quality-classes';
import { SourceSubstitution } from './source-substitution';
import { SourceSegmentGroups } from './source-segment-groups';

export interface ActualsProvenanceProps {
  periodId: string;
  timezone: string;
}

type DetailSlice = PeriodDetailView['slices'][number];

interface SliceProvenanceProps {
  slice: DetailSlice;
  timezone: string;
  productName: string;
  signalName: (signalId: string) => string | null;
}

function SliceProvenance({ slice, timezone, productName, signalName }: SliceProvenanceProps) {
  const actuals = slice.actuals;
  const { digits } = useCalendarPreference();
  return (
    <div className="mt-2 space-y-1" data-testid="provenance-slice">
      <p className="font-medium">{productName}</p>
      {actuals ? (
        <>
          <p>
            Good <Quantity value={actuals.good} uom={actuals.uom} /> · gross <Quantity value={actuals.gross} uom={actuals.uom} /> · from {labelOf(ACTUALS_METHOD_LABELS, actuals.method, 'unknown source')} · coverage{' '}
            {formatRatioPercent(actuals.coverageRatio, digits)} · {labelOf(ACTUALS_QUALITY_LABELS, actuals.qualityState)}
          </p>
          {actuals.substitution && <SourceSubstitution substitution={actuals.substitution} />}
          {actuals.qualityClasses && <QualityClasses classes={actuals.qualityClasses} uom={actuals.uom} />}
          <SourceSegmentGroups segments={actuals.sourceSegments} uom={actuals.uom} timezone={timezone} coverageText={formatRatioPercent(actuals.coverageRatio, digits)} signalName={signalName} />
          <ul className="list-disc pl-5 text-xs">
            {actuals.exceptions.map((e) => (
              <li key={`${e.code}-${e.from ?? ''}`} className={e.severity === 'problem' ? 'text-destructive' : undefined} data-code={e.code}>
                {e.severity === 'problem' ? 'Problem: ' : 'Note: '}
                {findingText(e)}
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
  const signalName = useUnitSignalNames(period.data?.data.unitId ?? null);
  const state = dataStateOf(period);
  if (state !== 'ready' || !period.data) return <DataState state={state} error={period.error} />;
  return (
    <details className="rounded-md border p-2 text-sm" data-testid="actuals-provenance">
      <summary className="cursor-pointer font-medium">Actuals provenance</summary>
      {period.data.data.slices.map((slice) => (
        <SliceProvenance key={slice.id} slice={slice} timezone={timezone} productName={products.nameOf(slice.productId)} signalName={signalName} />
      ))}
    </details>
  );
}
