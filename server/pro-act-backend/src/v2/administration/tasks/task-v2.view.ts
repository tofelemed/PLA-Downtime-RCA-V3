import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../../task/task.entity';

/** `GET /v2/tasks` item: names instead of user ids, and the server's overdue verdict. */
export interface TaskV2View {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  /** null when the user is not visible in this plant */
  assigneeName: string | null;
  assignedById: string;
  assignedByName: string | null;
  /** `Low` | `Medium` | `High` | `Critical` */
  priority: string;
  /** `Open` | `In Progress` | `Completed` | `Cancelled` */
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  /** due before `asOf` and neither completed nor cancelled */
  overdue: boolean;
  linkType: string | null;
  linkId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /v2/tasks/summary`: counts of the filtered tasks, computed on the server. */
export class TaskSummaryView {
  @ApiProperty() total: number;
  @ApiProperty() open: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() completed: number;
  @ApiProperty() cancelled: number;
  @ApiProperty({ description: 'Due before now and not completed or cancelled' })
  overdue: number;
  @ApiProperty() asOf: string;
}

const CLOSED: ReadonlySet<string> = new Set(['Completed', 'Cancelled']);

export function isOverdue(task: Task, now: Date): boolean {
  return (
    Boolean(task.dueDate) &&
    !CLOSED.has(task.status) &&
    new Date(task.dueDate as Date) < now
  );
}

const iso = (value: Date | null | undefined) =>
  value ? new Date(value).toISOString() : null;

export function toTaskView(
  task: Task,
  names: ReadonlyMap<string, string>,
  now: Date,
): TaskV2View {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    assigneeId: task.assignedTo,
    assigneeName: names.get(task.assignedTo) ?? null,
    assignedById: task.assignedBy,
    assignedByName: names.get(task.assignedBy) ?? null,
    priority: task.priority,
    status: task.status,
    dueDate: iso(task.dueDate),
    completedAt: iso(task.completedDate),
    overdue: isOverdue(task, now),
    linkType: task.entityType ?? null,
    linkId: task.entityId ?? null,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}
