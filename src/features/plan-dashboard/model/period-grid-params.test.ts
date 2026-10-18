import { describe, expect, it } from 'vitest';
import { gridWindow, parseGridParams, planDateBounds, residualStatesOf, withGridParam } from './period-grid-params';

const PLAN = { from: '2026-09-30T20:30:00.000Z', to: '2026-10-31T20:30:00.000Z' };
const TZ = 'Asia/Tehran';

describe('period grid URL filters and Go to date (UX audit D-5)', () => {
  it('reads only known workflow states and ISO dates from the URL', () => {
    expect(parseGridParams(new URLSearchParams('state=in_review&date=2026-10-12'))).toEqual({ workflow: 'in_review', date: '2026-10-12', residual: '' });
    expect(parseGridParams(new URLSearchParams('state=bogus&date=12/10/2026&residual=toString'))).toEqual({ workflow: '', date: '', residual: '' });
  });

  it('maps the residual filter of the URL to the server residual states (D-5)', () => {
    expect(parseGridParams(new URLSearchParams('residual=unaccounted')).residual).toBe('unaccounted');
    expect(residualStatesOf('unaccounted')).toEqual(['unaccounted']);
    expect(residualStatesOf('above')).toEqual(['unaccounted', 'over_accounted', 'conflict']);
    expect(residualStatesOf('')).toEqual([]);
    expect(withGridParam(new URLSearchParams('state=draft'), 'residual', 'above').toString()).toBe('state=draft&residual=above');
  });

  it('changes one filter and keeps the other parameters; an empty value removes it', () => {
    const next = withGridParam(new URLSearchParams('tab=periods&state=draft'), 'date', '2026-10-12');
    expect(next.toString()).toBe('tab=periods&state=draft&date=2026-10-12');
    expect(withGridParam(next, 'state', '').toString()).toBe('tab=periods&date=2026-10-12');
  });

  it('starts the server window at 00:00 plant time of the chosen date, up to the plan end', () => {
    expect(gridWindow(PLAN, '2026-10-12', TZ)).toEqual({ from: '2026-10-11T20:30:00.000Z', to: PLAN.to });
  });

  it('keeps the plan window without a date or for a date outside the plan', () => {
    expect(gridWindow(PLAN, '', TZ)).toBe(PLAN);
    expect(gridWindow(PLAN, '2026-12-01', TZ)).toBe(PLAN);
    expect(gridWindow(PLAN, '2026-09-01', TZ)).toBe(PLAN);
  });

  it('bounds the date field to the plan window in inclusive plant dates', () => {
    expect(planDateBounds(PLAN, TZ)).toEqual({ min: '2026-10-01', max: '2026-10-31' });
  });
});
