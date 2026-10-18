import { Link } from 'react-router-dom';
import type { RcaActionView } from '@/api/v2/types/rca';
import { labelOf, TASK_STATUS_LABELS } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';
import { CreateTaskButton } from '../case/actions/create-task-button';
import { useOptionalCaseWorkspace, type CaseWorkspaceValue } from '../case/case-context';

const CLOSED_TASK = new Set(['Completed', 'Cancelled']);

type LinkedAction = Pick<RcaActionView, 'id' | 'title' | 'ownerId' | 'dueDate' | 'status' | 'recommendationId' | 'linkedTask' | 'taskCompletedAt'>;

/** True when the action has a task that is still open (the server allows only one). */
const hasOpenTask = (action: Pick<RcaActionView, 'linkedTask'>) => Boolean(action.linkedTask && !CLOSED_TASK.has(action.linkedTask.status));

function TaskLine({ action, canCreate }: { action: LinkedAction; canCreate: boolean }) {
  const task = action.linkedTask;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="action-task">
      {task && (
        <span>
          Task:{' '}
          <Link to={`/tasks/${encodeURIComponent(task.id)}`} className="underline">
            {labelOf(TASK_STATUS_LABELS, task.status)}
          </Link>
        </span>
      )}
      {canCreate && !hasOpenTask(action) && <CreateTaskButton action={action} />}
    </span>
  );
}

const FINISHED = new Set(['done', 'cancelled']);

const mayCreateTask = (action: LinkedAction, workspace: CaseWorkspaceValue | null, canWrite: boolean) =>
  canWrite && workspace !== null && !workspace.readOnly && !FINISHED.has(action.status);

function linkFacts(action: LinkedAction, workspace: CaseWorkspaceValue | null, canWrite: boolean) {
  const recommendation = workspace?.rca.recommendations.find((rec) => rec.id === action.recommendationId);
  const canCreate = mayCreateTask(action, workspace, canWrite);
  const pendingEvidence = Boolean(action.taskCompletedAt) && action.status !== 'done';
  const visible = Boolean(action.recommendationId || action.linkedTask) || canCreate || pendingEvidence;
  return { recommendationTitle: recommendation?.title ?? 'a removed recommendation', canCreate, pendingEvidence, visible };
}

/**
 * Item 5: the recommendation an action implements, its Task Management task (status, link, create) and
 * a hint when the task is completed but the action is not: the server never completes the action itself.
 */
export function ActionLinks({ action, canWrite }: { action: LinkedAction; canWrite: boolean }) {
  const { recommendationTitle, canCreate, pendingEvidence, visible } = linkFacts(action, useOptionalCaseWorkspace(), canWrite);
  if (!visible) return null;
  return (
    <div className="space-y-1 text-muted-foreground" data-testid="action-links">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {action.recommendationId && (
          <span data-testid="action-recommendation">Implements: {recommendationTitle}</span>
        )}
        <TaskLine action={action} canCreate={canCreate} />
      </div>
      {pendingEvidence && (
        <StatusBadge tone="warning" icon={StatusIcon.info} data-testid="action-task-completed-hint">
          Task completed — record completion evidence to complete the action
        </StatusBadge>
      )}
    </div>
  );
}
