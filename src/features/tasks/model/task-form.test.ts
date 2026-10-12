import { describe, expect, it } from 'vitest';
import type { TaskView } from '@/api/v2/types/administration';
import { EMPTY_TASK_FORM, formOfTask, newTaskForm, toCreateTask, toUpdateTask, validateTaskForm } from './task-form';

const dayToInstant = (day: string) => `${day}T20:29:00.000Z`;
const dueToDay = (iso: string) => iso.slice(0, 10);

const task: TaskView = {
  id: 't1',
  title: 'Replace seal',
  description: 'Pump 3',
  assigneeId: 'u1',
  assigneeName: 'Otto',
  assignedById: 'u2',
  assignedByName: 'Mia',
  priority: 'High',
  status: 'Open',
  dueDate: '2026-10-20T20:29:00.000Z',
  completedAt: null,
  overdue: false,
  linkType: 'RCA',
  linkId: 'c1',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('task form model', () => {
  it('requires a title and an assignee', () => {
    expect(validateTaskForm(EMPTY_TASK_FORM)).toEqual({ title: 'Enter a title.', assigneeId: 'Choose who does it.' });
  });

  it('keeps a link only when another screen passed a known type and an id', () => {
    expect(newTaskForm('u1', 'RCA', 'c9')).toMatchObject({ assigneeId: 'u1', linkType: 'RCA', linkId: 'c9' });
    expect(newTaskForm('u1', 'Unknown', 'c9')).toMatchObject({ linkType: '', linkId: '' });
  });

  it('creates with the due day turned into the plant instant and without empty fields', () => {
    const values = { ...newTaskForm('u1', 'RCA', 'c9'), title: ' Check ', dueDate: '2026-10-21' };
    expect(toCreateTask(values, dayToInstant)).toEqual({
      title: 'Check',
      assigneeId: 'u1',
      priority: 'Medium',
      status: 'Open',
      dueDate: '2026-10-21T20:29:00.000Z',
      linkType: 'RCA',
      linkId: 'c9',
    });
  });

  it('updates only what changed and clears with null', () => {
    const original = formOfTask(task, dueToDay);
    expect(toUpdateTask(original, original, dayToInstant)).toEqual({});
    const changed = { ...original, description: '', dueDate: '', status: 'Completed' as const, linkType: '' as const };
    expect(toUpdateTask(changed, original, dayToInstant)).toEqual({ description: null, dueDate: null, status: 'Completed', linkType: null });
  });
});
