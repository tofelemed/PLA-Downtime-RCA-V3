import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { RcaCaseView, RcaEvidenceItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon, UiIcon } from '@/lib/icons';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';
import { useCaseWorkspace } from '../case-context';
import { useCasePatch } from '../use-case-patch';
import { AttachmentList } from './attachment-list';
import { CaseCard } from './case-card';
import { EvidenceMainFacts, EvidenceRecordFacts, EvidenceRequestFacts, SeriesFacts } from './evidence-facts';

const peopleOf = (item: RcaEvidenceItem | undefined) => (item ? [item.collectedBy, item.verifiedBy, item.taskAssigneeId] : []);

/** Labels of the logic-tree nodes and diagram events the item supports. */
function supportedNames(item: RcaEvidenceItem, rca: RcaCaseView): string {
  const labels = new Map([...rca.logicTree.map((n) => [n.id, n.label] as const), ...rca.eventDiagram.nodes.map((n) => [n.id, n.label] as const)]);
  return item.nodeIds.map((id) => labels.get(id)).filter(Boolean).join(', ');
}

function DetailActions({ item, editPath, onDelete, error }: { item: RcaEvidenceItem; editPath: string; onDelete: () => Promise<void>; error: unknown }) {
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link to={editPath} aria-label={`Edit evidence ${item.title}`}>
          <ActionIcon.edit aria-hidden="true" className="mr-1 h-4 w-4" />
          Edit
        </Link>
      </Button>
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
            <ActionIcon.delete aria-hidden="true" className="mr-1 h-4 w-4" />
            Delete
          </Button>
        }
        title="Delete this evidence?"
        description="Its file references and links to logic-tree nodes are removed too."
        confirmLabel="Delete evidence"
        destructive
        onConfirm={onDelete}
      >
        {error ? <FriendlyErrorAlert error={error} /> : null}
      </ConfirmDialog>
    </>
  );
}

/** `/rca/:caseId/evidence/:evidenceId`: one evidence item with its files, query and links (values as text). */
export function EvidenceDetailPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { evidenceId } = useParams();
  const navigate = useNavigate();
  const patch = useCasePatch();
  const { number } = useNumberFormat();
  const item = rca.evidence.find((entry) => entry.id === evidenceId);
  const users = useUserNames(peopleOf(item));
  const assets = useAssetNames();
  if (!item) return <Navigate to={`${basePath}/evidence`} replace />;
  const remove = async () => {
    await patch.save({ evidence: rca.evidence.filter((entry) => entry.id !== item.id) });
    navigate(`${basePath}/evidence`, { replace: true });
  };
  const editPath = `${basePath}/evidence/${encodeURIComponent(item.id)}/edit`;
  return (
    <div className="space-y-3">
      <Link className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline" to={`${basePath}/evidence`}>
        <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
        All evidence
      </Link>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <CaseCard title={item.title} actions={readOnly ? null : <DetailActions item={item} editPath={editPath} onDelete={remove} error={patch.error} />} testId="evidence-detail-card">
            <EvidenceMainFacts item={item} assetName={assets.nameOf} supports={supportedNames(item, rca)} />
          </CaseCard>
          <CaseCard title="Files" count={number(item.attachments.length)}>
            <AttachmentList rcaId={rca.id} attachments={item.attachments} />
          </CaseCard>
          {item.type === 'Time Series' && (
            <CaseCard title="Time series">
              <SeriesFacts item={item} />
            </CaseCard>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <CaseCard title={REQ.section} testId="evidence-request-card">
            <EvidenceRequestFacts item={item} userName={users.nameOf} />
          </CaseCard>
          <CaseCard title="Record">
            <EvidenceRecordFacts item={item} userName={users.nameOf} />
          </CaseCard>
        </div>
      </div>
    </div>
  );
}
