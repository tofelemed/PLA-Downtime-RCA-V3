import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { removeDecidedApproval } from '@/api/v2/queries/approval-inbox-cache';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Button } from '@/components/ui/button';
import { pageNameOf } from '@/features/auth/navigation-items';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { useToast } from '@/hooks/use-toast';
import { ApprovalDetailSummary } from './approval-detail-summary';
import { ApprovalEligibility } from './approval-eligibility';
import { isApprovalKind } from './approval-kinds';
import { ApprovalRecordDetails } from './approval-record-details';
import { ApprovalChangesPanel } from './changes/approval-changes-panel';
import { InlineDecision } from './inline/inline-decision';
import { useApprovalItem } from './use-approval-item';
import { useApprovalRecord } from './use-approval-record';

const INBOX = { to: '/approvals', label: pageNameOf('/approvals') };

/** After a server-confirmed decision: the row leaves every cached inbox page, a toast says what happened. */
function useDecided(item: ApprovalItem) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const { toast } = useToast();
  return async (label: string) => {
    if (tenantId) await removeDecidedApproval(client, tenantId, item);
    toast({ title: label, description: `${item.kindLabel}: ${item.title}` });
    navigate(INBOX.to);
  };
}

function ApprovalDetail({ item }: { item: ApprovalItem }) {
  const record = useApprovalRecord(item, true);
  const decided = useDecided(item);
  return (
    <Page>
      <PageHeader
        title={item.title}
        description={`${item.kindLabel} waiting for your decision`}
        back={INBOX}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to={item.reviewHref}>Open in workspace</Link>
          </Button>
        }
      />
      <div className="space-y-6" data-testid="approval-detail">
        <Section title="What needs your approval" description="Field by field against the approved version it replaces, or its full content when there is none.">
          <ApprovalChangesPanel item={item} />
        </Section>
        <Section title="Your decision">
          <div className="space-y-4">
            <ApprovalEligibility item={item} />
            <InlineDecision item={item} onDecided={(label) => void decided(label)} />
          </div>
        </Section>
        <Section title="Request">
          <ApprovalDetailSummary item={item} />
        </Section>
        {record.supported && (
          <Section title="Record content" description="The record as it is now, including its effective dates and evidence." collapsible defaultOpen={false}>
            <ApprovalRecordDetails record={record} />
          </Section>
        )}
      </div>
    </Page>
  );
}

/** A detail address that leads nowhere: the page header (h1, tab title) and the way back to the inbox, no Retry. */
function InboxReturn({ title, detail }: { title: string; detail: string }) {
  return (
    <Page>
      <PageHeader title={title} back={INBOX} />
      <DataState state="empty" detail={detail} />
      <Button className="mt-4" variant="outline" asChild>
        <Link to={INBOX.to}>Back to {INBOX.label}</Link>
      </Button>
    </Page>
  );
}

function ApprovalDetailScreen({ kind, id }: { kind: string; id: string }) {
  const item = useApprovalItem(kind, id);
  if (item.isLoading) return <DataState state="loading" />;
  if (item.isGone) {
    return <InboxReturn title="No longer pending" detail="This record is not waiting for your approval any more: it was decided, withdrawn or is outside your approval roles." />;
  }
  if (item.isError || !item.data) return <DataState state="error" error={item.error} onRetry={() => void item.refetch()} />;
  return <ApprovalDetail item={item.data} />;
}

/** `/approvals/:kind/:id`: one pending record, exactly what changes, who may decide, and the decision itself. */
export function ApprovalDetailPage() {
  const tenantId = useV2TenantId();
  const { kind = '', id = '' } = useParams();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see pending approvals." />;
  if (!isApprovalKind(kind)) return <InboxReturn title="Approval not found" detail="This address does not name an approval workflow. Open the record from the pending approvals list." />;
  return <ApprovalDetailScreen key={`${tenantId}:${kind}:${id}`} kind={kind} id={id} />;
}
