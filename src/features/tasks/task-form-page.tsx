import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCompleteTask, useCreateTask, useDeleteTask, useTask, useUpdateTask } from '@/api/v2/queries/administration-tasks';
import type { TaskView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PageGate } from '@/features/admin/shared/page-gate';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { resolvedActorText } from '@/features/ux-kit/labels/actor-labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { linkTargetOf } from './components/task-columns';
import { TaskForm } from './components/task-form';
import { formOfTask, newTaskForm, toCreateTask, toUpdateTask, type TaskFormValues } from './model/task-form';

const BACK = { to: '/tasks', label: 'Tasks' };

/** `/tasks/new` (optionally `?linkType=RCA&linkId=…`) and `/tasks/:taskId` (was the task dialog). */
export function TaskFormPage() {
  const { canViewOperations } = useCapabilities();
  const { taskId } = useParams();
  return (
    <PageGate title="Task" allowed={canViewOperations} deniedText="You don't have permission to see tasks.">
      {taskId ? <EditTask id={taskId} /> : <NewTask />}
    </PageGate>
  );
}

function NewTask() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const dates = usePlantDates();
  const create = useCreateTask();
  const feedback = useCommandFeedback();
  const initial = useMemo(() => newTaskForm(session?.user.id ?? '', params.get('linkType'), params.get('linkId')), [session, params]);
  const submit = async (values: TaskFormValues) => {
    const task = await feedback(() => create.submit(toCreateTask(values, dates.endOfDay)), 'Task created');
    navigate(`/tasks/${task.id}`, { replace: true });
  };
  return (
    <Page>
      <PageHeader title="New task" back={BACK} />
      <Section title="Details">
        <TaskForm initial={initial} readOnly={false} submitLabel="Create task" onSubmit={submit} onCancel={() => navigate(BACK.to)} />
      </Section>
    </Page>
  );
}

function EditTask({ id }: { id: string }) {
  const task = useTask(id);
  if (!task.data) {
    return (
      <Page>
        <PageHeader title="Task" back={BACK} />
        <DataState state={dataStateOf(task)} error={task.error} onRetry={() => void task.refetch()} back={BACK} />
      </Page>
    );
  }
  return <TaskDetail task={task.data} />;
}

function TaskDetail({ task }: { task: TaskView }) {
  const navigate = useNavigate();
  const { canWriteTasks } = useCapabilities();
  const dates = usePlantDates();
  const update = useUpdateTask();
  const feedback = useCommandFeedback();
  const original = useMemo(() => formOfTask(task, dates.dayOf), [task, dates]);
  const target = linkTargetOf(task);
  const submit = async (values: TaskFormValues) => {
    const body = toUpdateTask(values, original, dates.endOfDay);
    if (Object.keys(body).length === 0) return navigate(BACK.to);
    await feedback(() => update.submit({ id: task.id, body }), 'Task updated');
  };
  return (
    <Page>
      <PageHeader
        title={task.title}
        back={BACK}
        description={`Assigned by ${resolvedActorText(task.assignedById, task.assignedByName)} · created ${dates.date(task.createdAt)}`}
        actions={canWriteTasks && <TaskActions task={task} />}
        meta={target && <Link to={target} className="underline-offset-2 hover:underline">Open the linked investigation</Link>}
      />
      <Section title="Details">
        <TaskForm key={task.updatedAt} initial={original} assigneeName={task.assigneeName} readOnly={!canWriteTasks} submitLabel="Save changes" onSubmit={submit} onCancel={() => navigate(BACK.to)} />
      </Section>
    </Page>
  );
}

function TaskActions({ task }: { task: TaskView }) {
  const navigate = useNavigate();
  const complete = useCompleteTask();
  const remove = useDeleteTask();
  const feedback = useCommandFeedback();
  const open = task.status !== 'Completed' && task.status !== 'Cancelled';
  return (
    <>
      {open && (
        <Button variant="outline" disabled={complete.isPending} onClick={() => void feedback(() => complete.submit(task.id), 'Task completed').catch(() => undefined)}>
          <ActionIcon.approve aria-hidden="true" />
          Mark complete
        </Button>
      )}
      <ConfirmDialog
        trigger={
          <Button variant="destructive">
            <ActionIcon.delete aria-hidden="true" />
            Delete task
          </Button>
        }
        title={`Delete "${task.title}"?`}
        description="The task is removed for good. Mark it cancelled instead to keep a record."
        confirmLabel="Delete task"
        destructive
        onConfirm={async () => {
          await feedback(() => remove.submit(task.id), 'Task deleted');
          navigate(BACK.to);
        }}
      />
    </>
  );
}
