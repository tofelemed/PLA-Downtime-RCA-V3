import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PlanPeriodView, PlanPreviewView } from '@/api/v2/types/plans';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { sumMatchesHeader } from '../model/plan-form';

export interface PeriodPreviewProps {
  preview: PlanPreviewView;
  /** the version's entered header target (quantity basis), for the Σ indicator */
  headerTarget: string | null;
  timezone: string;
  productName: (id: string | null | undefined) => string;
}

const GRID = 'grid grid-cols-[7rem_4rem_minmax(0,1.6fr)_5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem] gap-2 px-2 py-1 text-xs';

/** Σ of the server totals against the header target — green when equal, red when not, absent otherwise. */
function SumBadge({ preview, headerTarget }: { preview: PlanPreviewView; headerTarget: string | null }) {
  const matches = sumMatchesHeader(preview.totals, headerTarget);
  const totals = preview.totals.map((total) => `${total.target} ${total.quantityUom ?? '(unit unknown)'}`).join(' · ');
  if (matches === null) return <Badge variant="outline" data-testid="sum-badge" data-match="n/a">Σ {totals || '—'}</Badge>;
  const Icon = matches ? CheckCircle2 : XCircle;
  return (
    <Badge className={matches ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} data-testid="sum-badge" data-match={String(matches)}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />Σ {totals} {matches ? '= header' : `≠ header ${headerTarget}`}
    </Badge>
  );
}

function PeriodRow({ period, timezone, productName }: { period: PlanPeriodView; timezone: string; productName: PeriodPreviewProps['productName'] }) {
  return (
    <div className={`${GRID} border-b ${period.isExcluded ? 'bg-muted text-muted-foreground' : ''}`} data-testid="preview-period" data-shift={period.shiftName} data-target={period.target} data-excluded={period.isExcluded}>
      <span>{period.localDate}</span>
      <span>{period.shiftName}</span>
      <span>
        <PlantTime iso={period.utcStart} tz={timezone} /> → <PlantTime iso={period.utcEnd} tz={timezone} />
      </span>
      <span><DurationText seconds={period.scheduledSeconds} variant="compact" /></span>
      <span>{productName(period.productId)}</span>
      <span data-testid="period-target"><Quantity value={period.target} uom={period.quantityUom} /></span>
      <span><Quantity value={period.planningCapacityQty} uom={period.quantityUom} /></span>
      <span><Quantity value={period.sustainedCapacityQty} uom={period.quantityUom} /></span>
      <span>{period.isExcluded ? `Excluded${period.exclusionKind ? ` (${period.exclusionKind})` : ''}` : 'Eligible'}</span>
    </div>
  );
}

/** PLAN03 preview: every leaf period the server would store, its target and capacities, totals and warnings. */
export function PeriodPreview({ preview, headerTarget, timezone, productName }: PeriodPreviewProps) {
  return (
    <section className="space-y-2" data-testid="period-preview">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Preview of version {preview.version}</span>
        <Badge variant="outline">{preview.distribution}</Badge>
        <SumBadge preview={preview} headerTarget={headerTarget} />
        <span className="text-muted-foreground">{preview.periods.length} periods · nothing stored</span>
      </div>
      {preview.warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-700" data-testid="preview-warnings">
          {preview.warnings.map((warning, index) => (
            <li key={`${warning.code}-${warning.at ?? index}`} data-code={warning.code}>
              {warning.code}
              {warning.at ? ` at ${warning.at}` : ''}
              {warning.detail ? ` — ${warning.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
      <div className={`${GRID} font-medium`} aria-hidden>
        <span>Date</span><span>Shift</span><span>Interval ({timezone})</span><span>Scheduled</span><span>Product</span><span>Target</span><span>Planning cap.</span><span>Sustained cap.</span><span>Status</span>
      </div>
      <VirtualList
        items={preview.periods}
        rowHeight={30}
        height={Math.min(400, 30 * preview.periods.length + 4)}
        getKey={(period) => `${period.sliceId}-${period.utcStart}`}
        renderRow={(period) => <PeriodRow period={period} timezone={timezone} productName={productName} />}
      />
    </section>
  );
}
