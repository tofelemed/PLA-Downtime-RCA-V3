import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { labelOf, useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import { RCA_EVIDENCE_TASK_LABELS, RCA_SERIES_MODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { verifiedText } from '../../model/evidence-form';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { TaskOverdueBadge } from './task-overdue-badge';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';
import { useCasePatch } from '../use-case-patch';
import { AttachmentList } from './attachment-list';

function TaskDue({ item }: { item: RcaEvidenceItem }) {
  const { day } = useRcaFormat();
  if (!item.taskDueDate) return null;
  return (
    <>
      {day(item.taskDueDate)}
      <TaskOverdueBadge item={item} />
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{children || '—'}</dd>
    </>
  );
}

function SeriesFacts({ item }: { item: RcaEvidenceItem }) {
  const { dateTime } = useRcaFormat();
  const series = item.timeSeries;
  if (!series) return <p className="text-sm text-muted-foreground">No historian query recorded.</p>;
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-sm">
      <Fact label="Streams / tags">{series.streams}</Fact>
      <Fact label="Mode">{labelOf(RCA_SERIES_MODE_LABELS, series.mode)}</Fact>
      <Fact label="From">{dateTime(series.start)}</Fact>
      <Fact label="To">{dateTime(series.end)}</Fact>
      <Fact label="Interval">{series.interval ?? (series.intervals ? `${series.intervals} intervals` : null)}</Fact>
      <Fact label="Summary types">{series.summaryTypes}</Fact>
    </dl>
  );
}

const peopleOf = (item: RcaEvidenceItem | undefined) => (item ? [item.collectedBy, item.verifiedBy, item.taskAssigneeId] : []);

function linkedNodeNames(item: RcaEvidenceItem, labels: Map<string, string>): string {
  return item.nodeIds.map((id) => labels.get(id)).filter(Boolean).join(', ');
}

/** `/rca/:caseId/evidence/:evidenceId`: one evidence item with its files, query and links. */
export function EvidenceDetailPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { evidenceId } = useParams();
  const navigate = useNavigate();
  const patch = useCasePatch();
  const item = rca.evidence.find((entry) => entry.id === evidenceId);
  const users = useUserNames(peopleOf(item));
  const assets = useAssetNames();
  const { dateTime } = useRcaFormat();
  if (!item) return <Navigate to={`${basePath}/evidence`} replace />;
  const labels = new Map([...rca.logicTree.map((n) => [n.id, n.label] as const), ...rca.eventDiagram.nodes.map((n) => [n.id, n.label] as const)]);
  const remove = async () => {
    await patch.save({ evidence: rca.evidence.filter((entry) => entry.id !== item.id) });
    navigate(`${basePath}/evidence`, { replace: true });
  };
  const actions = readOnly ? null : (
    <>
      <Button asChild size="sm" variant="outline">
        <Link to={`${basePath}/evidence/${encodeURIComponent(item.id)}/edit`}>
          <ActionIcon.edit aria-hidden="true" className="mr-1 h-4 w-4" />
          Edit
        </Link>
      </Button>
      <ConfirmDialog
        trigger={<Button size="sm" variant="outline">Delete</Button>}
        title="Delete this evidence?"
        description="The item, its file references and its links to logic-tree nodes are removed from the investigation."
        confirmLabel="Delete evidence"
        destructive
        onConfirm={remove}
      >
        {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
      </ConfirmDialog>
    </>
  );
  return (
    <>
      <Section title={item.title} actions={actions}>
        <p className="text-sm">
          <Link className="underline" to={`${basePath}/evidence`}>
            All evidence
          </Link>
        </p>
        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-sm" data-testid="evidence-detail">
          <Fact label="Type">{item.type}</Fact>
          <Fact label="Description">{item.description}</Fact>
          <Fact label="Source">{item.source}</Fact>
          <Fact label="Category">{item.category}</Fact>
          <Fact label="Location">{item.location}</Fact>
          <Fact label="Observed at">{item.occurredAt ? dateTime(item.occurredAt) : null}</Fact>
          <Fact label="Asset">{item.assetId ? assets.nameOf(item.assetId) : null}</Fact>
          <Fact label="Severity">{item.severity}</Fact>
          <Fact label="5P">{item.fiveP}</Fact>
          <Fact label="Tags">{item.tags.join(', ')}</Fact>
          <Fact label="Verified">
            <span data-testid="evidence-verified">{verifiedText(item, users.nameOf, dateTime)}</span>
          </Fact>
          <Fact label={REQ.request}>{item.task}</Fact>
          <Fact label={REQ.requestedFrom}>{item.taskAssigneeId && users.nameOf(item.taskAssigneeId)}</Fact>
          <Fact label={REQ.due}>
            <TaskDue item={item} />
          </Fact>
          <Fact label={REQ.status}>{labelOf(RCA_EVIDENCE_TASK_LABELS, item.taskStatus, 'Pending')}</Fact>
          <Fact label="Supports">{linkedNodeNames(item, labels)}</Fact>
          <Fact label="Collected">{[item.collectedBy ? users.nameOf(item.collectedBy) : null, item.collectedAt ? dateTime(item.collectedAt) : null].filter(Boolean).join(' · ')}</Fact>
        </dl>
      </Section>
      <Section title="Files">
        <AttachmentList rcaId={rca.id} attachments={item.attachments} />
      </Section>
      {item.type === 'Time Series' && (
        <Section title="Time series" description="The historian query recorded with this evidence.">
          <SeriesFacts item={item} />
        </Section>
      )}
    </>
  );
}
