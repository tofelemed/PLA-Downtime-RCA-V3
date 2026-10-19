import { describe, expect, it } from 'vitest';
import type { UnitStateCoverageView } from '@/api/v2/types/reliability';
import { sampleDisplayValue, type SignalSample } from './historian/historian-model';
import { ERROR_CODE_INFO } from './model/exception-flow';
import { signalUomText } from './model/signal-uom';
import { coverageSummaryText } from './mqtt/model/coverage-text';
import { identityStrategyLabel, IDENTITY_STRATEGY_OPTIONS, profileKindLabel } from './mqtt/model/profile-labels';

const RAW_KEYS = /seq_boot|measurement_json|event_id|payload_hash|schema_version/;

describe('integration console QA fixes (2026-10-19)', () => {
  it('M5: a counter shows its unit alone; only a rate carries the time base', () => {
    expect(signalUomText({ canonicalUom: 't', rateTimebase: 'h', semanticType: 'counter' })).toBe('t');
    expect(signalUomText({ canonicalUom: 't/h', rateTimebase: 'h', semanticType: 'rate' })).toMatch(/^t\/h per hour$/);
    expect(signalUomText({ canonicalUom: null, rateTimebase: null, semanticType: 'state' })).toBe('—');
  });

  it('M7: payload profile keys and the version refusal read as words, not raw keys', () => {
    for (const option of IDENTITY_STRATEGY_OPTIONS) expect(option.label).not.toMatch(RAW_KEYS);
    expect(identityStrategyLabel('')).toMatch(/\(default\)$/);
    expect(identityStrategyLabel('')).not.toMatch(RAW_KEYS);
    expect(profileKindLabel('measurement_json')).toBe('Measurements (signal samples)');
    expect(ERROR_CODE_INFO.unsupported_version.label).toBe('Unsupported message version');
  });

  it('M6 / M3: the MQTT setup coverage reads in durations and says where coverage starts', () => {
    const view: UnitStateCoverageView = {
      unitId: 'u1', from: '2026-10-16T20:30:00Z', to: '2026-10-17T20:30:00Z', truncated: false, coverageStartsAt: '2026-10-17T02:00:00Z', segments: [],
      coverage: { scheduledSeconds: 66600, runningSeconds: 61380, knownStoppedSeconds: 1800, unknownSeconds: 3420, coverage: 0.95, availabilityLower: 0.9, availabilityUpper: 0.95, knownTimeAvailability: 0.97, secondsByState: {} },
    };
    const text = coverageSummaryText(view, (s) => `${Math.round(s / 60)} min`, (iso) => `at ${iso}`);
    expect(text).toBe('From at 2026-10-17T02:00:00Z, when the first state mapping came into force: scheduled 1110 min; running 1023 min; stopped 30 min; unknown 57 min.');
    expect(coverageSummaryText({ ...view, coverage: null, coverageStartsAt: null }, String, String)).toBe('No state mapping in this window.');
  });

  it('L25: historian values have a fixed precision with separators; states keep their name', () => {
    const sample = (value: string | null, stateName: string | null = null) => ({ value, stateName }) as SignalSample;
    expect(sampleDisplayValue(sample('986.467'))).toBe('986.47');
    expect(sampleDisplayValue(sample('12345.5'))).toBe('12,345.50');
    expect(sampleDisplayValue(sample(null, 'RUN'))).toBe('RUN');
  });
});
