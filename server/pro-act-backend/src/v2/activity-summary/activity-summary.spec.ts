import { UnprocessableEntityException } from '@nestjs/common';
import { anonymousContext } from '../../common/context/request-context';
import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { ActivitySummaryQueryDto } from './activity-summary-v2.dto';
import { activityWindow, canReadAudit } from './activity-summary-v2.service';
import { foldAudit, foldWorkItems } from './activity-summary.sql';

const parse = (query: Record<string, unknown>) =>
  createValidationPipe().transform(query, {
    type: 'query',
    metatype: ActivitySummaryQueryDto,
  }) as Promise<ActivitySummaryQueryDto>;

const context = (roles: string[], isSuperAdmin = false) => ({
  ...anonymousContext('test'),
  roles,
  isSuperAdmin,
});

describe('activity summary (Reports, v1 RCA / task / audit summaries on v2)', () => {
  it('accepts a window and refuses unknown fields and bad instants', async () => {
    await expect(
      parse({ from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' }),
    ).resolves.toMatchObject({ from: '2026-10-01T00:00:00Z' });
    await expect(
      parse({ from: '2026-10-01', to: '2026-10-08T00:00:00Z' }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
    await expect(
      parse({
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-08T00:00:00Z',
        tenantId: 'x',
      }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });

  it('refuses a reversed or longer than 400 days window with 422', () => {
    expect(() =>
      activityWindow({
        from: '2026-10-08T00:00:00Z',
        to: '2026-10-01T00:00:00Z',
      }),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      activityWindow({
        from: '2025-01-01T00:00:00Z',
        to: '2026-10-01T00:00:00Z',
      }),
    ).toThrow(UnprocessableEntityException);
    expect(
      activityWindow({
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-08T00:00:00Z',
      }).to.toISOString(),
    ).toBe('2026-10-08T00:00:00.000Z');
  });

  it('folds (status, priority, day) cells into totals, open, overdue and sorted breakdowns', () => {
    const summary = foldWorkItems([
      {
        status: 'Open',
        priority: 'High',
        day: '2026-10-02',
        n: 2,
        open: 2,
        overdue: 1,
      },
      {
        status: 'Completed',
        priority: 'High',
        day: '2026-10-01',
        n: 3,
        open: 0,
        overdue: 0,
      },
      {
        status: 'Open',
        priority: 'Low',
        day: '2026-10-01',
        n: 1,
        open: 1,
        overdue: 0,
      },
    ]);
    expect(summary).toEqual({
      total: 6,
      open: 3,
      overdue: 1,
      byStatus: [
        { key: 'Completed', count: 3 },
        { key: 'Open', count: 3 },
      ],
      byPriority: [
        { key: 'High', count: 5 },
        { key: 'Low', count: 1 },
      ],
      createdByDay: [
        { day: '2026-10-01', count: 4 },
        { day: '2026-10-02', count: 2 },
      ],
    });
    expect(foldWorkItems([])).toEqual({
      total: 0,
      open: 0,
      overdue: 0,
      byStatus: [],
      byPriority: [],
      createdByDay: [],
    });
  });

  it('folds audit cells per action, entity type and day', () => {
    expect(
      foldAudit([
        { action: 'UPDATE', entity_type: 'Task', day: '2026-10-01', n: 2 },
        { action: 'CREATE', entity_type: 'Task', day: '2026-10-02', n: 5 },
      ]),
    ).toEqual({
      total: 7,
      byAction: [
        { key: 'CREATE', count: 5 },
        { key: 'UPDATE', count: 2 },
      ],
      byEntityType: [{ key: 'Task', count: 7 }],
      byDay: [
        { day: '2026-10-01', count: 2 },
        { day: '2026-10-02', count: 5 },
      ],
    });
  });

  it('shows audit activity to audit readers only', () => {
    expect(canReadAudit(context(['manager_approver']))).toBe(true);
    expect(canReadAudit(context(['TenantAdmin']))).toBe(true);
    expect(canReadAudit(context([], true))).toBe(true);
    expect(canReadAudit(context(['Operator', 'operator']))).toBe(false);
    expect(canReadAudit(context(['viewer']))).toBe(false);
  });
});
