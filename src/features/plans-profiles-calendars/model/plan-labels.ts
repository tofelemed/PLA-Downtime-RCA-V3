/** Plain words for the plan preview's warnings (backend `domain/plans/period-generator.ts`). */
export const PLAN_WARNING_LABELS: Readonly<Record<string, string>> = {
  missing_profile: 'No approved profile for this unit and product',
  missing_planning_rate: 'No approved planning rate',
  missing_sustained_rate: 'No approved sustained rate',
  rate_change_inside_leaf: 'A rate changes inside this shift',
  campaign_boundary_inside_leaf: 'A campaign starts or ends inside this shift',
  dst_leaf: 'Clock change inside this shift',
  clipped_leaf: 'Shift cut by the plan window',
  excluded_leaf: 'Shift excluded by the calendar',
  unassigned_leaf: 'Shift outside every product slice',
  unscheduled_time: 'Time without a scheduled shift',
};

/** Calendar exclusion kinds on a planned period (same words as the calendar editor). */
export const PERIOD_EXCLUSION_LABELS: Readonly<Record<string, string>> = {
  planned_shutdown: 'Planned shutdown',
  turnaround: 'Turnaround',
  no_demand: 'No demand',
  holiday: 'Holiday',
};
