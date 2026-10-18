import { EntityManager } from 'typeorm';
import { MonthClose } from '../../close/entities/month-close.entity';
import { MonthCloseState } from '../../domain/close/month-close-machine';
import { monthCloseStateOf, monthCloseStateView } from './month-close-state';

function close(state: MonthCloseState): MonthClose {
  return Object.assign(new MonthClose(), { state, monthKey: '2026-10' });
}

describe('month close state of a period (UX D-7)', () => {
  it('a month never acted on is open and revised directly', () => {
    expect(monthCloseStateView(null)).toEqual({
      state: 'open',
      monthKey: null,
      correctionPath: 'direct',
    });
  });

  it('an open month row keeps its key and is revised directly', () => {
    expect(monthCloseStateView(close('open'))).toEqual({
      state: 'open',
      monthKey: '2026-10',
      correctionPath: 'direct',
    });
  });

  it.each<[MonthCloseState, string]>([
    ['quantities_closed', 'none'],
    ['finance_signed_off', 'none'],
    ['locked', 'proposal'],
  ])('%s → correction path %s (SME R4)', (state, path) => {
    expect(monthCloseStateView(close(state))).toEqual({
      state,
      monthKey: '2026-10',
      correctionPath: path,
    });
  });

  it('reads the month row with one query by tenant and operational date', async () => {
    const getOne = jest.fn().mockResolvedValue(close('locked'));
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne,
    };
    const manager = {
      getRepository: () => ({ createQueryBuilder: () => qb }),
    } as unknown as EntityManager;
    const view = await monthCloseStateOf(manager, {
      tenantId: 't',
      localDate: '2026-10-05',
    });
    expect(view.state).toBe('locked');
    expect(getOne).toHaveBeenCalledTimes(1);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      localDate: '2026-10-05',
    });
  });
});
