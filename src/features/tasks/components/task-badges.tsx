import type { TaskView } from '@/api/v2/types/administration';
import { Badge } from '@/components/ui/badge';
import { labelOf, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/ux-kit/labels';
import { StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

const PRIORITY_CLASS: Readonly<Record<string, string>> = {
  Low: 'border-muted-foreground/30 text-muted-foreground',
  Medium: 'border-blue-300 text-blue-800 dark:text-blue-200',
  High: 'border-amber-400 text-amber-900 dark:text-amber-200',
  Critical: 'border-red-400 text-red-800 dark:text-red-200',
};

/** Priority as a word on a tinted badge (never colour alone). */
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn(PRIORITY_CLASS[priority])}>
      {labelOf(TASK_PRIORITY_LABELS, priority)}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'Completed' ? 'secondary' : 'outline'}>{labelOf(TASK_STATUS_LABELS, status)}</Badge>;
}

/** The due day in the plant calendar, with "Overdue" in words when the server says so. */
export function DueDate({ task, format }: { task: TaskView; format: (iso: string | null | undefined) => string }) {
  if (!task.dueDate) return <span className="text-muted-foreground">No due date</span>;
  return (
    <span className={cn('inline-flex items-center gap-1', task.overdue && 'text-destructive')}>
      {task.overdue && <StatusIcon.warning aria-hidden="true" className="h-3.5 w-3.5" />}
      {format(task.dueDate)}
      {task.overdue && <span className="text-xs font-medium">Overdue</span>}
    </span>
  );
}
