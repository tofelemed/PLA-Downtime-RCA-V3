import { describe, expect, it } from 'vitest';
import type { NotificationView } from '@/api/v2/types/notifications';
import { notificationText } from './notification-text';

const base = (kind: string, entityType: string, entityId: string, detail: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind, entityType, entityId, detail, read: false, readAt: null, createdAt: '2026-10-18T06:00:00.000Z',
});

describe('work reminders in the bell (item 6)', () => {
  it('an overdue corrective action names the action and the case and opens its actions', () => {
    const n = base('rca_action_overdue', 'rca_action', 'a1', { level: 1, title: 'Realign the pump', rcaId: 'c1', caseTitle: 'Pump trips', dueAt: '2026-10-10T00:00:00.000Z' });
    expect(notificationText(n, {})).toEqual({ title: 'Corrective action overdue', body: 'Realign the pump in “Pump trips”', href: '/rca/c1/actions' });
    expect(notificationText({ ...n, detail: { ...n.detail, level: 2 } }, {}).title).toBe('Corrective action overdue — escalated to you');
  });

  it('a task due soon opens the task', () => {
    const n = base('task_due', 'task', 't1', { level: 0, title: 'Collect the seal' });
    expect(notificationText(n, {})).toEqual({ title: 'Task due soon', body: 'Collect the seal', href: '/tasks/t1' });
  });

  it('a long open stop opens the event; an uncoded backlog opens the filtered event list in plant digits', () => {
    const stop = base('long_open_stop', 'production_event', 'e1', { level: 1, message: 'Stop running for 3 h', unitName: 'Extruder 1' });
    expect(notificationText(stop, {})).toEqual({ title: 'Long stop still running', body: 'Extruder 1: Stop running for 3 h', href: '/events/e1' });
    const backlog = base('uncoded_backlog', 'unit', 'u1', { level: 2, unitId: 'u1', unitName: 'Extruder 1', localDate: '2026-10-17', stops: 4 });
    expect(notificationText(backlog, {})).toEqual({
      title: 'Uncoded stops still waiting (escalated)',
      body: 'Extruder 1 · 2026-10-17: 4 stops waiting for a reason',
      href: '/events?units=u1&coding=uncoded',
    });
    expect(notificationText(backlog, { digits: 'persian' }).body).toContain('۴');
    expect(notificationText({ ...backlog, detail: { ...backlog.detail, stops: 1 } }, {}).body).toBe('Extruder 1 · 2026-10-17: 1 stop waiting for a reason');
  });
});
