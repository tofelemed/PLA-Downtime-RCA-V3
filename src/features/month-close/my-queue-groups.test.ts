import { describe, expect, it } from 'vitest';
import type { QueueItemView } from '@/api/v2/types/period-sla';
import { groupQueueRows } from './my-queue-groups';

const row = (periodId: string, patch: Partial<QueueItemView>): QueueItemView => ({
  periodId, unitId: 'u1', unitName: 'Unit 100', planId: 'plan-1', localDate: '2026-10-17', shiftName: null,
  utcStart: '2026-10-16T20:30:00.000Z', utcEnd: '2026-10-17T20:30:00.000Z', workflowState: 'draft', revision: 1,
  task: 'prepare', dueAt: '2026-10-20T06:00:00.000Z', overdue: false, escalationLevel: 0, escalatedTo: null,
  onHold: false, rejections: 0, rejectionEscalated: false, ...patch,
});

describe('My queue grouping (display only)', () => {
  const NOW = '2026-10-18T08:00:00.000Z';

  it('groups by the server overdue flag, then today on the plant clock, then later — keeping server order', () => {
    const rows = [
      row('later', {}),
      row('today', { dueAt: '2026-10-18T19:00:00.000Z' }),
      row('overdue', { overdue: true, dueAt: '2026-10-17T06:00:00.000Z', task: 'escalated' }),
      row('paused', { onHold: true, dueAt: '2026-10-18T10:00:00.000Z' }),
    ];
    const groups = groupQueueRows(rows, NOW, 'Asia/Tehran');
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.periodId)])).toEqual([
      ['Overdue', ['overdue']],
      ['Due today', ['today']],
      ['Later', ['later', 'paused']],
    ]);
  });

  it('uses the plant day: 21:00 UTC is already tomorrow in Tehran', () => {
    const groups = groupQueueRows([row('p', { dueAt: '2026-10-18T21:00:00.000Z' })], NOW, 'Asia/Tehran');
    expect(groups.map((g) => g.key)).toEqual(['later']);
  });

  it('leaves out empty groups', () => {
    expect(groupQueueRows([], NOW, 'UTC')).toEqual([]);
  });
});
