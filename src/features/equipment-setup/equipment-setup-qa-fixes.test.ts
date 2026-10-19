import { describe, expect, it } from 'vitest';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { lastPlantDay, readinessQuery } from './readiness-model';
import { productionDayWindow } from '@/features/ux-kit/production-day-window';
import { rangeFromDates } from '@/features/ux-kit/date-inputs';
import { dayStartText } from '@/features/ux-kit/use-operational-day-start';
import { canOpenStep, setupStep } from './setup-steps';

describe('equipment setup QA fixes (2026-10-19)', () => {
  it('L15: a master-data admin opens the master-data steps read-only; other pages keep their capability', () => {
    const bahram = capabilitiesOf(['master_data_admin']);
    expect(bahram.canWriteOeePolicy).toBe(false);
    expect(canOpenStep(setupStep('stop-policy'), bahram)).toBe(true);
    expect(canOpenStep(setupStep('state'), bahram)).toBe(true);
    expect(canOpenStep(setupStep('connection'), bahram)).toBe(false);
    const operator = capabilitiesOf(['operator']);
    expect(canOpenStep(setupStep('stop-policy'), operator)).toBe(false);
  });

  it('L14: the default readiness window is the last whole plant day, end exclusive internally', () => {
    const now = Date.parse('2026-10-19T08:00:00Z'); // 11:30 in Tehran
    expect(lastPlantDay('Asia/Tehran', now)).toEqual({ from: '2026-10-17T20:30:00.000Z', to: '2026-10-18T20:30:00.000Z' });
  });

  it('re-test N2: a date-only readiness window is production days from the operational day start', () => {
    const picked = rangeFromDates({ start: '2026-10-17', end: '2026-10-17' }, 'Asia/Tehran');
    expect(productionDayWindow(picked, '06:00', 'Asia/Tehran')).toEqual({ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' });
    const journey = { unitId: 'u1', connectionId: '', planId: '', periodId: '' } as Parameters<typeof readinessQuery>[0];
    const query = readinessQuery(journey, { productId: '', operatingMode: 'normal', range: picked }, { start: '06:00', timezone: 'Asia/Tehran' });
    expect(query).toMatchObject({ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' });
    expect(dayStartText('06:00:00')).toBe('06:00');
  });

  it('re-test N2: the default day is the last whole production day (before 06:00 the day before still runs)', () => {
    const early = Date.parse('2026-10-19T01:00:00Z'); // 04:30 Tehran, production day 18 Oct still open
    expect(lastPlantDay('Asia/Tehran', early, '06:00')).toEqual(rangeFromDates({ start: '2026-10-17', end: '2026-10-17' }, 'Asia/Tehran'));
    const later = Date.parse('2026-10-19T08:00:00Z');
    expect(lastPlantDay('Asia/Tehran', later, '06:00')).toEqual(rangeFromDates({ start: '2026-10-18', end: '2026-10-18' }, 'Asia/Tehran'));
  });
});
