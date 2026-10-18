import { useDeleteRcaCause } from '@/api/v2/queries/rca-commands';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { RcaErrorAlert } from '../../components/rca-error-alert';
import { useCaseWorkspace } from '../case-context';

export interface CauseItemProps {
  cause: RcaCaseCauseView;
  canWrite: boolean;
  onEdit: () => void;
}

function CauseCode({ cause }: { cause: RcaCaseCauseView }) {
  if (!cause.causeCode) return <span className="text-muted-foreground">No cause code</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="cause-code">
      {cause.causeCode.code} — {cause.causeCode.name}
      {!cause.causeCode.active && (
        <StatusBadge tone="warning" data-testid="cause-code-retired">
          Retired
        </StatusBadge>
      )}
    </span>
  );
}

function namesOf(ids: readonly string[], items: ReadonlyArray<{ id: string; name: string }>): string[] {
  return ids.map((id) => items.find((item) => item.id === id)?.name ?? 'a removed item');
}

/** Item 7: one cause — statement, code (retired codes marked), linked evidence and nodes, edit and delete. */
export function CauseItem({ cause, canWrite, onEdit }: CauseItemProps) {
  const { rca } = useCaseWorkspace();
  const remove = useDeleteRcaCause();
  const evidence = namesOf(cause.evidenceIds, rca.evidence.map((item) => ({ id: item.id, name: item.title })));
  const nodes = namesOf(cause.nodeIds, rca.logicTree.map((node) => ({ id: node.id, name: node.label })));
  return (
    <li className="space-y-1 p-3 text-sm" data-testid="cause-item">
      <p className="whitespace-pre-wrap font-medium">{cause.statement}</p>
      <CauseCode cause={cause} />
      {evidence.length > 0 && <p className="text-muted-foreground">Evidence: {evidence.join(', ')}</p>}
      {nodes.length > 0 && <p className="text-muted-foreground">Logic-tree nodes: {nodes.join(', ')}</p>}
      {remove.error ? <RcaErrorAlert error={remove.error} /> : null}
      {canWrite && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onEdit} data-testid="edit-cause">
            Edit
          </Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="outline" data-testid="delete-cause">Delete</Button>}
            title="Delete this cause?"
            description="It is removed from the investigation; the change is kept in the history."
            confirmLabel="Delete cause"
            destructive
            busy={remove.isPending}
            onConfirm={() => remove.submit(cause).catch(() => null)}
          />
        </div>
      )}
    </li>
  );
}
