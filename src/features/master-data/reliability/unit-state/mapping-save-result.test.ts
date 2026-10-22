import { describe, expect, it } from 'vitest';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { mappingSaveResult } from './mapping-save-result';

const SAVED: UnitStateMappingView = {
  id: 'm2', unitId: 'u1', signalId: 's1', version: 2, rules: [{ match: 'RUN', state: 'running' }],
  expectedIntervalSeconds: 10, jitterSeconds: 0, staleAfterIntervals: 3, isHeartbeat: true, staleAfterSeconds: 30,
  notes: null, effectiveFrom: '2026-10-22T08:00:00.000Z', effectiveTo: null,
};
const dateTime = (iso: string) => `at:${iso}`;
const NOW = Date.parse('2026-10-22T09:00:00.000Z');

describe('mappingSaveResult (save feedback of a new state mapping version)', () => {
  it('a version from now (or earlier) says it is in force; Back and Next keep the unit', () => {
    const result = mappingSaveResult({ saved: SAVED, dateTime, now: NOW });
    expect(result.title).toBe('Mapping version 2 recorded');
    expect(result.message).toBe('In force from at:2026-10-22T08:00:00.000Z; the previous version ended then.');
    expect(result.listPath).toBe('/master-data/unit-state?unitId=u1');
    expect(result.listLabel).toBe('Unit state');
    expect(result.next?.path).toContain('unitId=u1');
  });

  it('a version that takes effect later says the version in force stays until then', () => {
    const result = mappingSaveResult({ saved: { ...SAVED, effectiveFrom: '2026-10-23T00:00:00.000Z' }, dateTime, now: NOW });
    expect(result.message).toBe('It takes effect at at:2026-10-23T00:00:00.000Z; the version in force stays until then.');
  });
});
