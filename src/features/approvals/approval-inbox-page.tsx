import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApprovalInbox } from '@/api/v2/queries/approvals';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ApprovalStateCell } from './approval-state-cell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ApprovalRecordReview } from './approval-record-review';
import { ApprovalDecisionDialog } from './approval-decision-dialog';

const KINDS = [['profile', 'Production profiles'], ['rate', 'Production rates'], ['valuation-rate', 'Valuation rates'], ['transition-standard', 'Transition standards'], ['unit-stream', 'Unit streams'], ['flow-route', 'Plant flow routes'], ['unit-impact-rule', 'Unit impact rules'], ['plan', 'Production plans'], ['fx-rate', 'Exchange rates'], ['valuation-policy', 'Valuation policies'], ['demand-status', 'Demand statuses'], ['source-authority', 'Source priority'], ['source-status', 'Source status rules'], ['adjustment', 'Actuals adjustments'], ['disposition', 'Quality dispositions'], ['uncertainty-budget', 'Uncertainty budgets'], ['rule', 'Rule activations'], ['period-review', 'Period reconciliation'], ['finance-posting', 'Restatement postings'], ['change-proposal', 'Period change proposals'], ['rca-closure', 'RCA closures'], ['month-materiality', 'Month materiality review'], ['month-finance', 'Month finance sign-off'], ['month-lock', 'Month lock'], ['stop-merge', 'Duplicate stop reviews']];
function ApprovalActions({ item }: { item: ApprovalItem }) {
  const { isSuperAdmin } = useCapabilities();
  const disabled = item.actions.find((action) => action.disabledReason)?.disabledReason;
  return <div className="min-w-48 space-y-2"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to={item.reviewHref}>{item.actions.length ? 'Open workspace' : isSuperAdmin ? 'Review & decide' : 'Review record'}</Link></Button>{item.resource && item.resource !== 'source-status-mappings' && <ApprovalRecordReview item={item} />}{item.actions.filter((action) => !action.disabledReason).map((action) => <ApprovalDecisionDialog key={action.action} item={item} action={action.action} />)}</div>{disabled && <p className="text-xs text-muted-foreground">{disabled}</p>}{!item.actions.length && <p className="text-xs text-muted-foreground">{isSuperAdmin ? 'You can complete this review as SuperAdmin in the workspace.' : 'Decide in the review workspace after checking its evidence and gates.'}</p>}</div>;
}
function columns(timezone: string): DataTableColumn<ApprovalItem>[] {
  return [
    { id: 'record', header: 'Pending record', cell: (item) => <div className="max-w-md space-y-1"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.kindLabel}{item.version != null ? ` · v${item.version}` : ''}</p><p className="line-clamp-2 break-words text-xs text-muted-foreground">{item.summary}</p></div> },
    { id: 'scope', header: 'Unit / owner', cell: (item) => <div>{item.unitName ?? 'Plant-wide'}<p className="text-xs text-muted-foreground">{item.authorName ?? (item.authorId ? 'User ' + item.authorId : 'System / legacy record')}</p></div> },
    { id: 'created', header: 'Created', cell: (item) => <PlantTime iso={item.createdAt} tz={timezone} withDate /> },
    { id: 'state', header: 'State / required approval role', cell: (item) => <ApprovalStateCell item={item} /> },
    { id: 'actions', header: 'Review & decide', cell: (item) => <ApprovalActions item={item} /> },
  ];
}
function ApprovalInboxScreen() {
  const { isSuperAdmin } = useCapabilities();
  const [kind, setKind] = useState('');
  const inbox = useApprovalInbox(kind || undefined);
  const { timezone } = usePlantTimezone();
  return <Page width="wide"><div className="space-y-4" data-testid="approval-inbox"><PageHeader title="Pending Approvals" description="Pending records for your approval roles in this plant, oldest first. Draft versions appear here when their workflow has no separate submission step." />
    <p className="text-sm text-muted-foreground">{isSuperAdmin ? 'You are acting as SuperAdmin. You can approve for every workflow role, including your own requests. In review is the record’s current state; complete the review in its workspace.' : 'Approvals follow your assigned roles. A different approver must decide your own requests.'} Retire is offered only where that workflow supports it; Reject and Return keep their own meaning.</p>
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="approval-kind">Workflow</Label><select id="approval-kind" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All my approval roles</option>{KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><Button variant="outline" disabled={inbox.status.isRefreshing} onClick={() => void inbox.query.refetch()}>Refresh</Button><Button variant="link" asChild><Link to="/my-queue">Period preparation & escalations</Link></Button></div>
    <DataTable caption="Pending approvals for my roles" columns={columns(timezone)} rows={inbox.rows} getRowKey={(item) => `${item.kind}:${item.id}`} pager={inbox.pager} status={inbox.status} density="compact" empty={{ title: 'No pending approvals for your roles', text: 'There are no matching records in your approval scope. Try another workflow or check your plant selection and assigned roles in User Management.' }} />
    <p className="text-xs text-muted-foreground">Period, RCA, duplicate-stop and month-close reviews open their detailed workspace. Day certification remains in the production-day panel of each period workspace.</p>
  </div></Page>;
}
export function ApprovalInboxPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see pending approvals." />;
  return <ApprovalInboxScreen key={tenantId} />;
}
