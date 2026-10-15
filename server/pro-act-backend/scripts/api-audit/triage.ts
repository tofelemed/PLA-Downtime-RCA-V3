/**
 * Reviewed findings: what a person established about a generated finding by reading the call sites
 * (severity raised or lowered, with the reason). Applied on every run so the report stays reproducible.
 */
import { Defect, DefectCategory, Severity } from './audit-types';

interface TriageNote {
  /** `METHOD /api/path`, or `*` for every finding of the category */
  call: string;
  category: DefectCategory;
  severity: Severity;
  note: string;
}

const NOTES: TriageNote[] = [
  {
    call: 'GET /api/production-events',
    category: 'large-payload',
    severity: 'high',
    note: 'productionApi.getProductionEvents loads the whole tenant event list (≈10 MB) into DashboardAnalytics, LossEventTable, LossParetoChart, LossTrendChart, PlanWaterfallChart and PlanDashboard, which then compute KPIs in the browser (CLAUDE.md: never load a tenant’s full event list). Move these screens to the paginated v2 /production-events list and server-side reports.',
  },
  {
    call: '*',
    category: 'retired-route',
    severity: 'low',
    note: 'By design for plants with v2.planDashboard on (Demo Plant): the legacy PlanDashboard that calls these writes renders only when the flag is off (src/features/plan-dashboard/plan-dashboard-switch.tsx:23). Remove the calls when the v1 dashboard is retired.',
  },
  {
    call: 'PUT /api/app-settings/{key}',
    category: 'body-mismatch',
    severity: 'low',
    note: 'appSettingsApi.update has no caller today; the type still allows `key` in the body.',
  },
];

/** Applies the reviewed severity and note to matching defects. */
export function applyTriage(defects: Defect[]): Defect[] {
  return defects.map((defect) => {
    const note = NOTES.find(
      (n) =>
        (n.call === '*' || n.call === `${defect.method} ${defect.path}`) &&
        n.category === defect.category,
    );
    return note
      ? {
          ...defect,
          severity: note.severity,
          detail: `${defect.detail} Reviewed: ${note.note}`,
        }
      : defect;
  });
}

/** Defects found while reviewing the generated ones (reproduced by hand; evidence recorded). */
export const MANUAL_FINDINGS: Defect[] = [];
