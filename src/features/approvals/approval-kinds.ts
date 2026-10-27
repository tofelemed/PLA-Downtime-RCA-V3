/** The inbox workflows in the order the inbox filter lists them (value = the server's `kind`). */
export const APPROVAL_KINDS: ReadonlyArray<readonly [string, string]> = [
  ['profile', 'Production profiles'],
  ['rate', 'Production rates'],
  ['valuation-rate', 'Valuation rates'],
  ['transition-standard', 'Transition standards'],
  ['unit-stream', 'Unit streams'],
  ['flow-route', 'Plant flow routes'],
  ['unit-impact-rule', 'Unit impact rules'],
  ['plan', 'Production plans'],
  ['fx-rate', 'Exchange rates'],
  ['valuation-policy', 'Valuation policies'],
  ['demand-status', 'Demand statuses'],
  ['source-authority', 'Source priority'],
  ['loss-accounting', 'Loss accounting'],
  ['source-status', 'Source status rules'],
  ['adjustment', 'Actuals adjustments'],
  ['disposition', 'Quality dispositions'],
  ['uncertainty-budget', 'Uncertainty budgets'],
  ['rule', 'Rule activations'],
  ['period-review', 'Period reconciliation'],
  ['finance-posting', 'Restatement postings'],
  ['change-proposal', 'Period change proposals'],
  ['rca-closure', 'RCA closures'],
  ['month-materiality', 'Month materiality review'],
  ['month-finance', 'Month finance sign-off'],
  ['month-lock', 'Month lock'],
  ['stop-merge', 'Duplicate stop reviews'],
];

const KNOWN_KINDS: ReadonlySet<string> = new Set(APPROVAL_KINDS.map(([value]) => value));

/** Whether `kind` is an inbox workflow (an `/approvals/:kind/:id` address with another kind leads nowhere). */
export function isApprovalKind(kind: string): boolean {
  return KNOWN_KINDS.has(kind);
}
