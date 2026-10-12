import { Link } from 'react-router-dom';
import { useCompleteTask } from '@/api/v2/queries/administration-tasks';
import type { TaskView } from '@/api/v2/types/administration';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { IconButton } from '@/features/ux-kit/icon-button';
import { labelOf, TASK_LINK_LABELS } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { DueDate, PriorityBadge, TaskStatusBadge } from './task-badges';

/** Where a linked record opens (only links with a screen of their own). */
export function linkTargetOf(task: Pick<TaskView, 'linkType' | 'linkId'>): string | null {
  if (task.linkType === 'RCA' && task.linkId) return `/rca?case=${encodeURIComponent(task.linkId)}`;
  return null;
}

export function LinkedTo({ task }: { task: TaskView }) {
  if (!task.linkType) return <span className="text-muted-foreground">—</span>;
  const label = labelOf(TASK_LINK_LABELS, task.linkType);
  const target = linkTargetOf(task);
  return target ? (
    <Link to={target} className="underline-offset-2 hover:underline" onClick={(event) => event.stopPropagation()}>
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  );
}

function CompleteButton({ task }: { task: TaskView }) {
  const complete = useCompleteTask();
  const feedback = useCommandFeedback();
  if (task.status === 'Completed' || task.status === 'Cancelled') return null;
  return (
    <IconButton
      icon={ActionIcon.approve}
      label={`Mark "${task.title}" complete`}
      disabled={complete.isPending}
      onClick={(event) => {
        event.stopPropagation();
        void feedback(() => complete.submit(task.id), 'Task completed').catch(() => undefined);
      }}
    />
  );
}

/** Columns of the tasks table; `canWrite` adds the "Mark complete" action. */
export function taskColumns(formatDate: (iso: string | null | undefined) => string, canWrite: boolean): ReadonlyArray<DataTableColumn<TaskView>> {
  const columns: DataTableColumn<TaskView>[] = [
    {
      id: 'title',
      header: 'Task',
      cell: (task) => (
        <div className="min-w-0 max-w-md">
          <p className="font-medium">{task.title}</p>
          {task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}
        </div>
      ),
    },
    { id: 'assignee', header: 'Assignee', cell: (task) => task.assigneeName ?? 'Unknown user' },
    { id: 'priority', header: 'Priority', cell: (task) => <PriorityBadge priority={task.priority} />, nowrap: true },
    { id: 'status', header: 'Status', cell: (task) => <TaskStatusBadge status={task.status} />, nowrap: true },
    { id: 'due', header: 'Due', cell: (task) => <DueDate task={task} format={formatDate} />, nowrap: true },
    { id: 'link', header: 'Linked to', cell: (task) => <LinkedTo task={task} /> },
  ];
  if (canWrite) {
    columns.push({ id: 'complete', header: <span className="sr-only">Complete</span>, headerLabel: 'Complete', cell: (task) => <CompleteButton task={task} /> });
  }
  return columns;
}
