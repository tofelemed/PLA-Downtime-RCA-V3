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

  it('decorates a page with one query and gives events without periods "none"', async () => {
    const query = jest.fn().mockResolvedValue([
      { event_id: 'e1', state: 'approved' },
      { event_id: 'e1', state: 'in_review' },
    ]);
    const manager = { query } as unknown as EntityManager;
    const views = await withAccountingStates(manager, 't1', [
      { id: 'e1' },
      { id: 'e2' },
    ]);
    expect(views).toEqual([
      { id: 'e1', accountingState: 'in_review' },
      { id: 'e2', accountingState: 'none' },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.any(String), [
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
