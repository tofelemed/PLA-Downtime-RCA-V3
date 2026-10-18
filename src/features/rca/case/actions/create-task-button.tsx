import { useState } from 'react';
import { Link } from 'react-router-dom';
import { v2Request } from '@/api/v2/client';
import { V2ApiError } from '@/api/v2/errors';
import { useCreateTask } from '@/api/v2/queries/administration-tasks';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { CreateTaskInput, TaskView } from '@/api/v2/types/administration';
import type { RcaActionView, RcaRecommendationItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { actionTask, caseTask, recommendationTask } from '../../model/task-payload';
import { useCaseWorkspace } from '../case-context';

type TaskAction = Pick<RcaActionView, 'id' | 'title' | 'ownerId' | 'dueDate' | 'linkedTask'>;

export interface CreateTaskButtonProps {
  recommendation?: RcaRecommendationItem;
  /** item 5: a task carrying out this action (the server allows one open task per action) */
  action?: TaskAction;
}

/** True when a task of this case already carries the title (one request, made on click). */
async function taskExists(rcaId: string, title: string): Promise<boolean> {
  const page = await v2Request<ListResponse<TaskView>>({ method: 'GET', path: '/tasks', query: { linkType: 'RCA', linkId: rcaId, q: title.slice(0, 100), limit: 20 } });
  return page.data.items.some((task) => task.title === title);
}

const isActionTaskConflict = (error: unknown) => error instanceof V2ApiError && error.code === 'ACTION_TASK_EXISTS';

function labelsOf({ recommendation, action }: CreateTaskButtonProps): { text: string; aria: string } {
  if (action) return { text: 'Create task', aria: `Create task for action ${action.title}` };
  if (recommendation) return { text: 'Create task from recommendation', aria: `Create task from recommendation ${recommendation.title}` };
  return { text: 'Create investigation task', aria: 'Create investigation task' };
}

/** Item 5: the action already has an open task (409), with a link to it when the action names it. */
function ExistingTaskNote({ action }: { action: TaskAction }) {
  const task = action.linkedTask;
  return (
    <p role="status" className="text-sm" data-testid="action-task-exists">
      This action already has an open task.{' '}
      <Link to={task ? `/tasks/${encodeURIComponent(task.id)}` : '/tasks'} className="underline">
        {task ? 'Open the task' : 'Open Task Management'}
      </Link>
    </p>
  );
}

/**
 * Creates a task in Task Management for the case, one recommendation (never twice for the same title) or
 * one action (sent with `rcaActionId`; the server refuses a second open task with 409 ACTION_TASK_EXISTS).
 */
export function CreateTaskButton(props: CreateTaskButtonProps) {
  const { recommendation, action } = props;
  const { rca } = useCaseWorkspace();
  const { session } = useAuth();
  const create = useCreateTask();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const labels = labelsOf(props);
  const bodyOf = (userId: string): CreateTaskInput => {
    if (action) return actionTask(rca, action, userId);
    return recommendation ? recommendationTask(rca, recommendation, userId) : caseTask(rca, userId);
  };
  const run = async () => {
    if (!session) return;
    setBusy(true);
    setConflict(false);
    try {
      const body = bodyOf(session.user.id);
      if (!action && (await taskExists(rca.id, body.title))) {
        toast({ title: 'A task already exists', description: `"${body.title}" is already in Task Management.` });
        return;
      }
      await create.submit(body);
      toast({ title: 'Task created', description: `"${body.title}" is in Task Management.` });
    } catch (error) {
      if (action && isActionTaskConflict(error)) setConflict(true);
      else toast({ ...friendlyToastContent(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !session}
        aria-label={labels.aria}
        data-testid={action ? 'create-action-task' : undefined}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void run();
        }}
      >
        {labels.text}
      </Button>
      {conflict && action && <ExistingTaskNote action={action} />}
    </span>
  );
}

/** Task Management, where the tasks of this case are followed up. */
export function TasksLink() {
  return (
    <Button asChild size="sm" variant="ghost">
      <Link to="/tasks">Open Task Management</Link>
    </Button>
  );
}
