/** What each PLA page can show: one URL parameter per page (`breakdown`, `series`, `inspection`, `valuation`), first option = default. */
export interface ViewMode {
  value: string;
  label: string;
}

export const BREAKDOWN_MODES: readonly ViewMode[] = [
  { value: 'tree', label: 'Loss tree' },
  { value: 'opportunities', label: 'Top opportunities' },
  { value: 'repeat-causes', label: 'Repeat causes' },
  { value: 'loss-events', label: 'Loss events' },
];

export const SERIES_MODES: readonly ViewMode[] = [
  { value: 'oee', label: 'OEE over time' },
  { value: 'residual', label: 'Unaccounted over time' },
  { value: 'units', label: 'OEE by unit' },
  { value: 'products', label: 'OEE by product' },
];

export const INSPECTION_MODES: readonly ViewMode[] = [
  { value: 'status', label: 'Reconciliation status' },
  { value: 'quality', label: 'Actuals quality coverage' },
];

export const VALUATION_MODES: readonly ViewMode[] = [
  { value: 'margin', label: 'Contribution margin' },
  { value: 'standard_cost', label: 'Standard cost' },
  { value: 'operational_cost', label: 'Operational cost' },
  { value: 'economic_impact', label: 'Economic impact components' },
];

/** The OEE policies a trend can show, named without "Operational" or "(ISO 22400)" (owner, 24 Oct 2026). */
export const TREND_POLICY_LABELS = { operational: 'OEE', reconciled: 'Reconciled PLA OEE' } as const;
