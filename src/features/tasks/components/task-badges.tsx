import type { TaskView } from '@/api/v2/types/administration';
import { labelOf, PRIORITY_TONES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

/** Priority as a word on a tinted badge (never colour alone): Critical red, High amber, others neutral. */
export function PriorityBadge({ priority }: { priority: string }) {
  return <StatusBadge tone={toneOf(PRIORITY_TONES, priority)}>{labelOf(TASK_PRIORITY_LABELS, priority)}</StatusBadge>;
}

export function TaskStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={toneOf(TASK_STATUS_TONES, status)}>{labelOf(TASK_STATUS_LABELS, status)}</StatusBadge>;
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
