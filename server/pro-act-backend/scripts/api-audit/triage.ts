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
    call: 'GET /api/connectivity/integrations/pi',
    category: 'live-5xx',
    severity: 'high',
    note: 'Root cause is the shadowed route: `integrations/:id` (declared first, no ParseUUIDPipe) receives "pi" → Postgres "invalid input syntax for type uuid" → 500 (backend log, SystemIntegrationService.findOne).',
  },
  {
    call: 'GET /api/connectivity/integrations/cmms',
    category: 'live-5xx',
    severity: 'high',
    note: 'Same root cause as /pi: `integrations/:id` swallows "cmms" → invalid uuid → 500.',
  },
  {
    call: 'GET /api/pi-browser/{tenantId}/eventframes',
    category: 'live-4xx',
    severity: 'low',
    note: 'Data state, not a code defect: Demo Plant has no active PI connection, so 404 is the designed answer; the screen should render it as "no PI connection" rather than an error.',
  },
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
    call: 'POST /api/verification-status-codes',
    category: 'body-mismatch',
    severity: 'high',
    note: 'Confirmed sent: src/components/rca-settings/VerificationChecklists.tsx:125 passes `color` (default #3B82F6) and `items`, so creating a verification checklist always fails with 400 "property color / items should not exist" (live: POST {color, items} → 400). The update DTO accepts both but the entity has no such columns (see the PUT 500).',
  },
  {
    call: 'POST /api/rca-cause-codes',
    category: 'body-mismatch',
    severity: 'high',
    note: 'Confirmed sent: src/components/rca-settings/RCACauseLibraryTree.tsx:127 sends `parentId` when adding a child cause → 400 "property parentId should not exist"; only root causes (parentId undefined) can be added. Add parentId to CreateRcaCauseCodeDto (the tree needs it).',
  },
  {
    call: 'PUT /api/rca-cause-codes/{id}',
    category: 'body-mismatch',
    severity: 'medium',
    note: 'MasterDataService.updateRCACauseCode forwards parentId when a caller sets it (re-parenting a cause would fail); the tree editor does not send it today.',
  },
  {
    call: 'POST /api/unmapped-events',
    category: 'body-mismatch',
    severity: 'low',
    note: 'Type-level only: buildPayload (src/services/api/unmappedEventApi.ts:103) folds reason / suggestions / event into eventData before sending.',
  },
  {
    call: 'PUT /api/unmapped-events/{id}',
    category: 'body-mismatch',
    severity: 'low',
    note: 'Type-level only: buildPayload folds reason / suggestions / event into eventData before sending.',
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
export const MANUAL_FINDINGS: Defect[] = [
  {
    severity: 'high',
    category: 'live-5xx',
    method: 'PUT',
    path: '/api/verification-status-codes/{id}',
    frontend:
      'src/components/rca-settings/VerificationChecklists.tsx:116 (masterDataService.updateVerificationStatusCode)',
    backend:
      'VerificationStatusCodeController.update @ server/pro-act-backend/src/verification-status-code/verification-status-code.controller.ts:38; UpdateVerificationStatusCodeDto',
    detail:
      'The edit form always sends `color` (and `items`); UpdateVerificationStatusCodeDto whitelists both, but the VerificationStatusCode entity has neither column, so repository.update throws EntityPropertyNotFoundError → 500 on every checklist edit.',
    fix: 'Either add color / items columns (migration with down) or drop them from UpdateVerificationStatusCodeDto and the form payload; keep the create and update DTOs consistent.',
    evidence:
      'PUT /api/verification-status-codes/<absent id> {"color":"#3B82F6","items":["a"]} → 500, log: Property "color" was not found in "VerificationStatusCode".',
  },
];
