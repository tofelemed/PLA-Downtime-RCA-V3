import { Link, useNavigate, useParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { useToast } from '@/hooks/use-toast';
import { DECIDED_LABELS } from './approval-command';
import { ApprovalDetailActions } from './approval-detail-actions';
import { ApprovalDetailSummary } from './approval-detail-summary';
import { ApprovalEligibility } from './approval-eligibility';
import { ApprovalRecordDetails } from './approval-record-details';
import { useApprovalItem } from './use-approval-item';
import { useApprovalRecord } from './use-approval-record';

const INBOX = { to: '/approvals', label: 'Pending Approvals' };

function ApprovalDetail({ item }: { item: ApprovalItem }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const record = useApprovalRecord(item, true);
  const decided = (action: ApprovalAction) => {
    toast({ title: DECIDED_LABELS[action], description: `${item.kindLabel}: ${item.title}` });
    navigate(INBOX.to);
  };
  return (
    <Page>
      <PageHeader title={item.title} description={`${item.kindLabel} waiting for your decision`} back={INBOX} actions={<ApprovalDetailActions item={item} onDecided={decided} />} />
      <div className="space-y-6" data-testid="approval-detail">
        <Section title="What needs approval">
          <ApprovalDetailSummary item={item} />
        </Section>
        <Section title="Your decision">
          <ApprovalEligibility item={item} />
        </Section>
        <Section title="Record content" description="The record as it is now, including its effective dates and evidence. Open the full workspace for history and related records.">
          {record.supported ? <ApprovalRecordDetails record={record} /> : <p className="text-sm text-muted-foreground">This review’s evidence and checks are in its workspace.</p>}
        </Section>
      </div>
    </Page>
  );
}

function ApprovalDetailScreen({ kind, id }: { kind: string; id: string }) {
  const item = useApprovalItem(kind, id);
  if (item.isLoading) return <DataState state="loading" />;
  if (item.isGone) {
    return (
      <Page>
        <PageHeader title="No longer pending" back={INBOX} />
        <DataState state="empty" detail="This record is not waiting for your approval any more: it was decided, withdrawn or is outside your approval roles." />
        <Button className="mt-4" variant="outline" asChild>
          <Link to={INBOX.to}>Back to Pending Approvals</Link>
        </Button>
      </Page>
    );
  }
  if (item.isError || !item.data) return <DataState state="error" error={item.error} onRetry={() => void item.refetch()} />;
  return <ApprovalDetail item={item.data} />;
}

/** `/approvals/:kind/:id`: one pending record, what it asks, who may decide, and the decision itself. */
export function ApprovalDetailPage() {
  const tenantId = useV2TenantId();
  const { kind = '', id = '' } = useParams();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see pending approvals." />;
  return <ApprovalDetailScreen key={`${tenantId}:${kind}:${id}`} kind={kind} id={id} />;
}
