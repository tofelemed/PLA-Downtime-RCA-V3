import { ifMatchOf } from '@/api/v2/etag-cache';
import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
export interface ApprovalDecision { item: ApprovalItem; action: ApprovalAction; reason: string; supersede: boolean }
const VERSION_RESOURCES = ['profiles', 'rates', 'valuation-rates', 'transition-standards', 'unit-streams', 'flow-routes', 'unit-impact-rules', 'fx-rates', 'demand-statuses'];
const PROPOSAL_RESOURCES = ['actuals/adjustments', 'lot-dispositions', 'uncertainty-budgets', 'source-authority/versions', 'loss-accounting/versions'];
export function needsReason(action: ApprovalAction): boolean { return ['reject', 'return', 'activate'].includes(action); }
type CommandBody = (input: ApprovalDecision) => Record<string, unknown>;
const withReason: CommandBody = ({ reason }) => reason.trim() ? { reason: reason.trim() } : {};
const versionBody: CommandBody = ({ action, supersede }) => action === 'approve' ? { supersede } : {};
const planBody: CommandBody = (input) => ({ expectedVersion: input.item.version, ...withReason(input) });
function bodyPolicy(resource: string): { actions: ApprovalAction[]; body: CommandBody } | null {
  if (VERSION_RESOURCES.includes(resource)) return { actions: ['approve', 'retire'], body: versionBody };
  if (PROPOSAL_RESOURCES.includes(resource)) return { actions: ['approve', 'reject'], body: withReason };
  if (resource === 'production-plans') return { actions: ['approve', 'return'], body: planBody };
  if (resource === 'valuation-policies') return { actions: ['approve'], body: () => ({}) };
  if (resource === 'rules') return { actions: ['activate', 'retire'], body: withReason };
  return null;
}
/** Commands retain each workflow's API body, optimistic concurrency and audit path. */
export function approvalCommand(input: ApprovalDecision): { path: string; body: Record<string, unknown>; ifMatch?: string } {
  const { item, action, reason } = input;
  const available = item.actions.find((candidate) => candidate.action === action);
  if (!available || available.disabledReason || !item.resource) throw new Error('This decision is not available. Refresh the inbox.');
  const policy = bodyPolicy(item.resource);
  if (!policy?.actions.includes(action)) throw new Error('Open this record’s review workspace to make the decision.');
  if ((needsReason(action) || item.resource === 'rules') && !reason.trim()) throw new Error('Enter a reason for this decision.');
  return { path: `/${item.resource}/${item.commandId}/${action}`, body: policy.body(input), ...(item.resource === 'rules' ? { ifMatch: ifMatchOf(item.rowVersion) } : {}) };
}
export const ACTION_LABELS: Record<ApprovalAction, string> = { approve: 'Approve', reject: 'Reject', return: 'Return to author', retire: 'Retire', activate: 'Approve & activate' };
/** Toast title once the server confirmed a decision. */
export const DECIDED_LABELS: Record<ApprovalAction, string> = { approve: 'Approved', reject: 'Rejected', return: 'Returned to author', retire: 'Retired', activate: 'Approved and activated' };
