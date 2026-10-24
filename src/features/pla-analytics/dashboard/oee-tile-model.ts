import type { KpiAggregateView } from '@/api/v2/types/reports';
import type { DigitSystem } from '@/lib/dates';
import { kpiText } from '../model/display';
import { OEE_AVAILABILITY_CAPTION } from './availability-captions';
import { unavailableReason } from './kpi-unavailable';
import type { KpiTileSpec } from './kpi-tile';

export const OPERATIONAL_LABEL = 'Operational OEE (ISO 22400)';
export const RECONCILED_LABEL = 'Reconciled PLA OEE';

export interface PolicyLabels {
  operational: string;
  reconciled: string;
}

export interface OeeTileDef {
  id: 'operational' | 'availability' | 'performance' | 'quality' | 'reconciled';
  /** the KPI metric of the OEE report this tile shows */
  metric: string;
  title: string;
  highlight?: boolean;
  /** what the figure is (denominator, policy label): shown in the tooltip, not under the value */
  meaning: (labels: PolicyLabels) => string;
}

export const OEE_TILES: readonly OeeTileDef[] = [
  { id: 'operational', metric: 'oee', title: 'Operational OEE', highlight: true, meaning: (l) => `${l.operational}: good output at the sustained rate (as time) ÷ scheduled time.` },
  { id: 'availability', metric: 'availability', title: 'Availability', meaning: () => OEE_AVAILABILITY_CAPTION },
  { id: 'performance', metric: 'performance', title: 'Performance', meaning: () => 'Output at the sustained rate ÷ run time, over the same periods.' },
  { id: 'quality', metric: 'quality', title: 'Quality', meaning: () => 'Good ÷ total output, over the same periods.' },
  { id: 'reconciled', metric: 'reconciled_oee', title: 'Reconciled PLA OEE', meaning: (l) => `${l.reconciled}: capacity-ledger good ÷ capacity.` },
];

/** The tile's spec (title and tooltip text); a missing value adds the server's reason to the tooltip. */
export function oeeTileSpec(def: OeeTileDef, view: KpiAggregateView | undefined, labels: PolicyLabels): KpiTileSpec {
  const reason = unavailableReason(view);
  const meaning = def.meaning(labels);
  return { title: def.title, highlight: def.highlight, info: reason === null ? meaning : `${meaning} Not available: ${reason}.` };
}

/** The tile's value text in the plant's digits, or null when the server has no value. */
export function oeeTileValue(view: KpiAggregateView | undefined, digits?: DigitSystem): string | null {
  return unavailableReason(view) === null ? kpiText(view, digits) : null;
}
