/**
 * The role-aware first row of the dashboard (UX audit §5.6 "For you"): which tiles a user's effective
 * roles in the plant ask for. Display only — every figure comes from the server, and the server still
 * filters each list by the caller's scope.
 */
export type ForYouTileKey = 'currentStops' | 'stopsToCode' | 'periodsDue' | 'recommended' | 'myOverdueActions' | 'approvals';

/** Operators and supervisors (production engineers verify stop coding, SME D13). */
const STOP_ROLES: readonly string[] = ['operator', 'Operator', 'production_engineer'];

/**
 * QA audit 2026-10-19: every role that decides an inbox kind (plans, revisions, postings, dispositions,
 * budgets, source priority and status rules, month close, investigations), not only manager approvers;
 * the tile counts only what the caller can decide (`decidable=true`).
 */
export const APPROVAL_ROLES: readonly string[] = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'Manager',
  'manager_approver',
  'production_accountant',
  'quality_approver',
  'metrology_approver',
  'finance_approver',
];

const TILES_BY_ROLE: ReadonlyArray<readonly [readonly string[], readonly ForYouTileKey[]]> = [
  [STOP_ROLES, ['currentStops', 'stopsToCode']],
  [['production_accountant'], ['periodsDue']],
  [['reliability_engineer'], ['recommended', 'myOverdueActions']],
  [APPROVAL_ROLES, ['approvals']],
];

/** The tiles of the "For you" row, in a fixed order, each once; empty when no role asks for one. */
export function forYouTilesOf(roles: readonly string[]): ForYouTileKey[] {
  const keys = TILES_BY_ROLE.filter(([wanted]) => roles.some((role) => wanted.includes(role))).flatMap(([, tiles]) => tiles);
  return [...new Set(keys)];
}

/**
 * A count from one server page of a list without a total: the page's row count, with "+" when the
 * server has a further page (the Event Hub "Current stops (50+)" rule). Nothing is summed in the browser.
 */
export function pageCountText(rows: number, hasMore: boolean, format: (value: number) => string): string {
  return hasMore ? `${format(rows)}+` : format(rows);
}
