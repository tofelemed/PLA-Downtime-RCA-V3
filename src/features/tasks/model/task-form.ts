import type {
  CreateTaskInput,
  TaskLinkType,
  TaskPriority,
  TaskStatus,
  TaskView,
  UpdateTaskInput,
} from '@/api/v2/types/administration';
import { TASK_LINK_TYPES } from '@/api/v2/types/administration';

/** The task form as typed; the due date is a plant-calendar day (`YYYY-MM-DD`) or empty. */
export interface TaskFormValues {
  title: string;
  description: string;
  assigneeId: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  linkType: TaskLinkType | '';
  linkId: string;
}

export type TaskFormErrors = Partial<Record<'title' | 'assigneeId', string>>;

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: '',
  description: '',
  assigneeId: '',
  priority: 'Medium',
  status: 'Open',
  dueDate: '',
  linkType: '',
  linkId: '',
};

const isLinkType = (value: string | null | undefined): value is TaskLinkType =>
  Boolean(value) && (TASK_LINK_TYPES as readonly string[]).includes(value as string);

/** A new task, optionally linked from another screen (`/tasks/new?linkType=RCA&linkId=…`). */
export function newTaskForm(assigneeId: string, linkType: string | null, linkId: string | null): TaskFormValues {
  const linked = isLinkType(linkType) && linkId ? { linkType, linkId } : {};
  return { ...EMPTY_TASK_FORM, assigneeId, ...linked };
}

/** `dueToDay` turns the stored instant into the plant day shown in the date field. */
export function formOfTask(task: TaskView, dueToDay: (iso: string) => string): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assigneeId,
    priority: task.priority as TaskPriority,
    status: task.status as TaskStatus,
    dueDate: task.dueDate ? dueToDay(task.dueDate) : '',
    linkType: isLinkType(task.linkType) ? task.linkType : '',
    linkId: task.linkId ?? '',
  };
}

export function validateTaskForm(values: TaskFormValues): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (!values.title.trim()) errors.title = 'Enter a title.';
  if (!values.assigneeId) errors.assigneeId = 'Choose who does it.';
  return errors;
}

/** `dayToInstant` turns the plant day into the instant the task is due (end of that day, plant time). */
export function toCreateTask(values: TaskFormValues, dayToInstant: (day: string) => string): CreateTaskInput {
  return {
    title: values.title.trim(),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    assigneeId: values.assigneeId,
    priority: values.priority,
    status: values.status,
    ...(values.dueDate ? { dueDate: dayToInstant(values.dueDate) } : {}),
    ...(values.linkType && values.linkId ? { linkType: values.linkType, linkId: values.linkId } : {}),
  };
}

/** Only what changed; clearing the description, due date or link sends null. */
export function toUpdateTask(values: TaskFormValues, original: TaskFormValues, dayToInstant: (day: string) => string): UpdateTaskInput {
  const input: UpdateTaskInput = {};
  if (values.title.trim() !== original.title) input.title = values.title.trim();
  if (values.description.trim() !== original.description) input.description = values.description.trim() || null;
  if (values.assigneeId !== original.assigneeId) input.assigneeId = values.assigneeId;
  if (values.priority !== original.priority) input.priority = values.priority;
  if (values.status !== original.status) input.status = values.status;
  if (values.dueDate !== original.dueDate) input.dueDate = values.dueDate ? dayToInstant(values.dueDate) : null;
  if (!values.linkType && original.linkType) input.linkType = null;
  return input;
}
