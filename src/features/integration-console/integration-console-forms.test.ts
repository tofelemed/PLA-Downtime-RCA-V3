import { describe, expect, it } from 'vitest';
import type { SourceMappingView } from '@/api/v2/types/integration-mappings';
import { samplesCsv, tooLong, trendPoints, type SignalSample } from './historian/historian-model';
import { emptyMappingForm, mappingBody, mappingFormErrors, mappingFormOf, sourceSystemOf } from './model/mapping-form';
import { emptySignalForm, signalBody, signalFormErrors } from './model/signal-form';
import { connectionPath, consolePath, historianPath } from './paths';

const sample = (observedAt: string, value: string | null, inWindow = true): SignalSample => ({
  observedAt, value, stateName: null, quality: 'good', sourceRevision: '1', revisions: 1, inWindow,
});

describe('historian model', () => {
  it('draws only numeric in-window samples and thins long series by stride, keeping the last point', () => {
    const samples = [sample('2026-10-10T00:00:00Z', '1'), sample('2026-10-10T00:01:00Z', null), sample('2026-10-09T23:00:00Z', '9', false), sample('2026-10-10T00:02:00Z', 'x')];
    expect(trendPoints(samples)).toEqual([{ t: Date.parse('2026-10-10T00:00:00Z'), value: 1 }]);
    const many = Array.from({ length: 10 }, (_, index) => sample(new Date(Date.UTC(2026, 9, 10, 0, index)).toISOString(), String(index)));
    const thinned = trendPoints(many, 4);
    expect(thinned.map((point) => point.value)).toEqual([0, 3, 6, 9]);
  });

  it('exports in-window samples as ISO UTC CSV with quoted cells', () => {
    const csv = samplesCsv([{ name: 'Feed, line 1', samples: [sample('2026-10-10T00:00:00Z', '12.5'), sample('2026-10-09T00:00:00Z', '1', false)] }]);
    expect(csv).toBe('signal,observed_at_utc,value,state,quality,revisions\n"Feed, line 1",2026-10-10T00:00:00Z,12.5,,good,1\n');
  });

  it('refuses periods longer than 31 days', () => {
    expect(tooLong('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(false);
    expect(tooLong('2026-09-01T00:00:00Z', '2026-10-03T00:00:00Z')).toBe(true);
  });
});

describe('source mapping form', () => {
  it('requires a value and a target and checks the precedence range', () => {
    expect(mappingFormErrors({ ...emptyMappingForm(), precedence: '2000' })).toEqual({
      matchValue: 'Enter the source value to match.',
      targetId: 'Choose the unit.',
      precedence: 'Enter a whole number from -1000 to 1000.',
    });
  });

  it('takes the source system from the chosen connection, or the picked kind for every connection', () => {
    const form = { ...emptyMappingForm(), matchValue: ' \\\\AF\\Line1 ', targetId: 'u1', connectionId: 'c1' };
    expect(mappingBody(form, 'mqtt')).toMatchObject({ matchValue: '\\\\AF\\Line1', connectionId: 'c1', sourceSystem: 'MQTT', precedence: 0, description: null });
    expect(mappingBody({ ...form, connectionId: '', sourceSystem: '*' }, null)).toMatchObject({ connectionId: null, sourceSystem: '*' });
    expect(sourceSystemOf('pi_web_api')).toBe('PI');
  });

  it('round-trips an existing rule', () => {
    const rule = { id: 'm1', connectionId: null, sourceSystem: 'PI', matchKind: 'pattern', matchValue: 'a/*', normalizedValue: 'a/*', precedence: 5, targetType: 'asset', targetId: 'a1', effectiveFrom: null, effectiveTo: null, version: 2, rowVersion: 2, isActive: false, description: 'x', legacyMappingId: 'l1' } as SourceMappingView;
    expect(mappingBody(mappingFormOf(rule), null)).toEqual({ matchKind: 'pattern', matchValue: 'a/*', targetType: 'asset', targetId: 'a1', precedence: 5, connectionId: null, sourceSystem: 'PI', effectiveFrom: null, effectiveTo: null, isActive: false, description: 'x' });
  });
});

describe('signal form', () => {
  it('requires name, source key and unit; numbers are checked like the server does', () => {
    const errors = signalFormErrors({ ...emptySignalForm(), maxGapSeconds: '0', expectedMax: '1e3' });
    expect(Object.keys(errors).sort()).toEqual(['expectedMax', 'maxGapSeconds', 'name', 'sourceKey', 'unitId']);
  });

  it('sends counter-only settings only for counters and the time base only for rates and counters', () => {
    const base = { ...emptySignalForm(), name: 'Feed', sourceKey: 'W1', unitId: 'u1', rolloverModulus: '1000' };
    expect(signalBody({ ...base, semanticType: 'level' }, 'c1')).toMatchObject({ connectionId: 'c1', rateTimebase: undefined, resetPolicy: undefined, rolloverModulus: undefined, maxGapSeconds: 900 });
    expect(signalBody({ ...base, semanticType: 'counter' }, 'c1')).toMatchObject({ rateTimebase: 'h', resetPolicy: 'none', rolloverModulus: '1000' });
  });
});

describe('connectivity paths', () => {
  it('links tabs, records and trends', () => {
    expect(consolePath()).toBe('/connectivity');
    expect(consolePath('quarantine')).toBe('/connectivity?tab=quarantine');
    expect(connectionPath('c1', 'jobs')).toBe('/connectivity/connections/c1?tab=jobs');
    expect(historianPath(['s1', 's2'])).toBe('/enhanced-historian?signal=s1&signal=s2');
  });
});

describe('sample display value', () => {
  it('drops trailing zeros of stored decimals and falls back to the state name', async () => {
    const { sampleValue } = await import('./historian/historian-model');
    expect(sampleValue(sample('2026-10-10T00:00:00Z', '1500.00000000'))).toBe('1500');
    expect(sampleValue(sample('2026-10-10T00:00:00Z', '1503.50000000'))).toBe('1503.5');
    expect(sampleValue({ ...sample('2026-10-10T00:00:00Z', null), stateName: 'running' })).toBe('running');
  });
});
