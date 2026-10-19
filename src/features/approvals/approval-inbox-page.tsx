import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useApprovalInbox } from '@/api/v2/queries/approvals';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ListPager } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ApprovalInboxGroups } from './approval-inbox-groups';
import { APPROVAL_KINDS, isApprovalKind } from './approval-kinds';

interface Filters {
  kind: string;
  setKind: (kind: string) => void;
  decidable: boolean;
  setDecidable: (value: boolean) => void;
}

function InboxFilters({ kind, setKind, decidable, setDecidable }: Filters) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="approval-kind">Workflow</Label>
        <select id="approval-kind" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">All my approval roles</option>
          {APPROVAL_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="flex h-10 items-center gap-2">
        <Checkbox id="approval-decidable" checked={decidable} onCheckedChange={(value) => setDecidable(value === true)} />
        <Label htmlFor="approval-decidable">Only what I can decide</Label>
      </div>
    </>
  );
}

function EmptyInbox({ decidable }: { decidable: boolean }) {
  return (
    <div className="rounded-md border p-6 text-center" role="status">
      <p className="font-medium">No pending approvals for your roles</p>
      <p className="text-sm text-muted-foreground">
        {decidable
          ? 'Nothing waits for your decision. Clear “Only what I can decide” to see requests others must decide.'
          : 'There are no matching records in your approval scope. Try another workflow or check your plant selection and assigned roles in User management.'}
      </p>
    </div>
  );
}

/** The Workflow filter lives in the URL (`?kind=`), so a reload or a shared link keeps it; unknown kinds read as "all". */
function useKindParam(): [string, (kind: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('kind') ?? '';
  const kind = isApprovalKind(raw) ? raw : '';
  const setKind = (next: string) => setParams((current) => {
    const updated = new URLSearchParams(current);
    if (next) updated.set('kind', next);
    else updated.delete('kind');
    return updated;
  }, { replace: true });
  return [kind, setKind];
}

function ApprovalInboxScreen() {
  const { isSuperAdmin } = useCapabilities();
  const [kind, setKind] = useKindParam();
  const [decidable, setDecidable] = useState(false);
  const inbox = useApprovalInbox(kind || undefined, decidable);
  const { timezone } = usePlantTimezone();
  const { rows, status } = inbox;
  const ready = !status.isLoading && !status.isError;
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="approval-inbox">
        <PageHeader title={pageNameOf('/approvals')} description="Pending records for your approval roles in this plant, oldest first, grouped by workflow. Each row says what changes; open it to decide in place." />
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin ? 'You are acting as SuperAdmin. You can decide for every workflow role, including your own requests.' : 'Approvals follow your assigned roles. A different approver must decide your own requests.'} Retire is offered only where that workflow supports it; Reject and Return keep their own meaning.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <InboxFilters kind={kind} setKind={setKind} decidable={decidable} setDecidable={setDecidable} />
          <Button variant="outline" disabled={Boolean(status.isRefreshing)} onClick={() => void inbox.query.refetch()}>Refresh</Button>
          <Button variant="link" asChild><Link to="/my-queue">Period preparation & escalations</Link></Button>
        </div>
        {status.isLoading && <DataState state="loading" />}
        {status.isError && <DataState state="error" error={status.error} onRetry={status.onRetry} />}
        {ready && rows.length === 0 && <EmptyInbox decidable={decidable} />}
        {rows.length > 0 && <ApprovalInboxGroups rows={rows} timezone={timezone} />}
        {ready && <ListPager pager={inbox.pager} label="Pending approvals pages" />}
      </div>
    </Page>
  );
}

/** `/approvals`: the plant's pending records for the caller's approval roles, grouped by workflow. */
export function ApprovalInboxPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see pending approvals." />;
  return <ApprovalInboxScreen key={tenantId} />;
}
