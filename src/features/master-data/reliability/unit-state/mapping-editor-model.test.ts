import { describe, expect, it } from 'vitest';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { lastPlantDays } from '../shared/use-plant-window';
import { bodyOf, draftErrors, draftOf, withoutRule, withRule, withRuleChange } from './mapping-editor-model';

const CURRENT: UnitStateMappingView = {
  id: 'm1', unitId: 'u1', signalId: 's1', version: 1, rules: [{ match: 'RUN', state: 'running' }],
  expectedIntervalSeconds: 10, jitterSeconds: 2, staleAfterIntervals: 3, isHeartbeat: true, staleAfterSeconds: 32,
  notes: null, effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: null,
};

describe('unit state mapping editor (SME D1 / D2)', () => {
  it('a first version starts from the pilot staleness (3 intervals, no jitter, heartbeat)', () => {
    expect(draftOf(undefined)).toMatchObject({ signalId: '', jitterSeconds: '0', staleAfterIntervals: '3', isHeartbeat: true });
    expect(draftErrors(draftOf(undefined))).toEqual({
      signalId: 'Choose the state signal',
      rules: 'Every rule needs a signal value',
      expectedIntervalSeconds: 'Whole seconds from 1 to 86400',
    });
  });

  it('edits the rules of the version in force and sends a typed body', () => {
    let draft = withRule(draftOf(CURRENT));
    draft = withRuleChange(draft, 1, { match: ' STOP ', state: 'internal_stop' });
    draft = withRuleChange(withRule(draft), 2, { match: 'X' });
    draft = withoutRule(draft, 2);
    expect(draftErrors(draft)).toEqual({});
    expect(bodyOf('u1', { ...draft, isHeartbeat: false, effectiveFrom: '2026-10-15T06:00:00.000Z' })).toEqual({
      unitId: 'u1', signalId: 's1',
      rules: [{ match: 'RUN', state: 'running' }, { match: 'STOP', state: 'internal_stop' }],
      expectedIntervalSeconds: 10, jitterSeconds: 2, staleAfterIntervals: 3, isHeartbeat: false,
      effectiveFrom: '2026-10-15T06:00:00.000Z',
    });
    expect(draftErrors({ ...draft, staleAfterIntervals: '0' }).staleAfterIntervals).toBe('A whole number from 1 to 100');
  });

  it('plan 1.10: an analog mapping needs no rule and sends its thresholds (hysteresis, rated value)', () => {
    const draft = { ...draftOf(CURRENT), rules: [], analog: { stopBelow: '2', reducedBelow: '16', hysteresis: '0.5', ratedValue: '20', stopState: 'internal_stop' as const } };
    expect(draftErrors(draft)).toEqual({});
    expect(bodyOf('u1', draft).thresholds).toEqual({ stopBelow: 2, reducedBelow: 16, hysteresis: 0.5, stopState: 'internal_stop', ratedValue: 20 });
    expect(draftErrors({ ...draft, analog: { ...draft.analog, reducedBelow: '1' } }).analog).toEqual({ reducedBelow: 'A number above the stop threshold' });
    expect(draftErrors({ ...draft, analog: null }).rules).toBe('Add a rule, or analog thresholds');
    expect(draftOf({ ...CURRENT, thresholds: { stopBelow: 2, reducedBelow: null, hysteresis: 0, stopState: 'starved', ratedValue: null } }).analog).toEqual({
      stopBelow: '2', reducedBelow: '', hysteresis: '0', ratedValue: '', stopState: 'starved',
    });
  });

  it('the default window is whole plant days ending after today', () => {
    const range = lastPlantDays(7, 'Asia/Tehran', new Date('2026-10-15T10:00:00Z'));
    expect(range).toEqual({ from: '2026-10-08T20:30:00.000Z', to: '2026-10-15T20:30:00.000Z' });
  });
});
