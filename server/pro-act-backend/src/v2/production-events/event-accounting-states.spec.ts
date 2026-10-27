import { EntityManager } from 'typeorm';
import {
  eventAccountingStateOf,
  withAccountingStates,
} from './event-accounting-states';

describe('event accounting state (owner finding 2)', () => {
  it('shows open work first, approved only when every calculated period is approved', () => {
    expect(eventAccountingStateOf([])).toBe('none');
    expect(eventAccountingStateOf(['approved'])).toBe('approved');
    expect(eventAccountingStateOf(['approved', 'in_review'])).toBe('in_review');
    expect(eventAccountingStateOf(['draft', 'stale'])).toBe('stale');
    expect(eventAccountingStateOf(['approved', 'draft'])).toBe('draft');
  });

  it('decorates a page with one state query and one period query; events without periods get "none" and null', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { event_id: 'e1', state: 'approved' },
        { event_id: 'e1', state: 'in_review' },
      ])
      .mockResolvedValueOnce([
        {
          eventId: 'e1',
          periodId: 'p1',
          utcStart: new Date('2026-10-29T02:30:00Z'),
          utcEnd: new Date('2026-10-30T02:30:00Z'),
          localDate: '2026-10-29',
          shiftName: null,
        },
      ]);
    const manager = { query } as unknown as EntityManager;
    const views = await withAccountingStates(manager, 't1', [
      { id: 'e1' },
      { id: 'e2' },
    ]);
    expect(views).toEqual([
      {
        id: 'e1',
        accountingState: 'in_review',
        accountingPeriod: {
          periodId: 'p1',
          utcStart: '2026-10-29T02:30:00.000Z',
          utcEnd: '2026-10-30T02:30:00.000Z',
          localDate: '2026-10-29',
          shiftName: null,
        },
      },
      { id: 'e2', accountingState: 'none', accountingPeriod: null },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, expect.any(String), [
      't1',
      ['e1', 'e2'],
    ]);
    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      't1',
      ['e1', 'e2'],
    ]);
  });

  it('runs no query for an empty page', async () => {
    const query = jest.fn();
    await withAccountingStates({ query } as unknown as EntityManager, 't1', []);
    expect(query).not.toHaveBeenCalled();
  });
});
