import {
  caseEffectiveness,
  effectivenessOf,
  EffectivenessCriteria,
  ExposureWindow,
} from './effectiveness';

const HOURS = (n: number) => String(n * 3600);
const window = (
  incidents: number,
  hours: number,
  downtime = '0',
): ExposureWindow => ({
  from: '2027-01-01T00:00:00.000Z',
  to: '2027-04-01T00:00:00.000Z',
  incidents,
  downtimeSeconds: downtime,
  exposureSeconds: HOURS(hours),
});
const CRITERIA: EffectivenessCriteria = {
  requiredReduction: 0.5,
  minExposureHours: 720,
  zeroRepeat: false,
};

describe('effectivenessOf (SME CA2 / CA3)', () => {
  it('CA2 example: 5 in 1,000 run hours before, 1 in 1,000 after = 80 % reduction, effective', () => {
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(5, 1000),
      correctedBaseline: null,
      post: window(1, 1000),
      criteria: CRITERIA,
    });
    expect(result).toMatchObject({
      verdict: 'effective',
      baselineRate: '5',
      postRate: '1',
      reduction: '0.8',
      mtbfLowerBound95Hours: null,
    });
  });

  it('CA2 example: zero failures in 900 h gives a 95 % lower MTBF bound of ~300 h, not infinity', () => {
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(5, 1000),
      correctedBaseline: null,
      post: window(0, 900),
      criteria: CRITERIA,
    });
    expect(result.verdict).toBe('effective');
    expect(result.mtbfLowerBound95Hours).toBe('300.4');
  });

  it('CA3 example: an approved correction (3 of 800 h) replaces the counted 4, = 3.75 per 1,000 h', () => {
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(4, 800),
      correctedBaseline: '3',
      post: window(2, 800),
      criteria: CRITERIA,
    });
    expect(result.baselineRate).toBe('3.75');
    expect(result.verdict).toBe('not_effective');
    expect(result.reduction).toBe('0.3333');
  });

  it('too little run time after the action is insufficient evidence', () => {
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(5, 1000),
      correctedBaseline: null,
      post: window(0, 300),
      criteria: CRITERIA,
    });
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons[0]).toContain('720 run hours');
  });

  it('no same-mode history before is insufficient; a repeat then is not effective', () => {
    const none = {
      metric: 'recurrences' as const,
      baseline: window(0, 1000),
      correctedBaseline: null,
      criteria: CRITERIA,
    };
    expect(effectivenessOf({ ...none, post: window(0, 1000) }).verdict).toBe(
      'insufficient_evidence',
    );
    expect(effectivenessOf({ ...none, post: window(1, 1000) }).verdict).toBe(
      'not_effective',
    );
  });

  it('a high-consequence mode is not effective on any repeat, even when the rate improved', () => {
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(10, 1000),
      correctedBaseline: null,
      post: window(1, 1000),
      criteria: { ...CRITERIA, zeroRepeat: true },
    });
    expect(result.verdict).toBe('not_effective');
  });

  it('downtime metric compares seconds per 1,000 run hours', () => {
    const result = effectivenessOf({
      metric: 'downtime_seconds',
      baseline: window(3, 1000, '36000'),
      correctedBaseline: null,
      post: window(3, 1000, '7200'),
      criteria: CRITERIA,
    });
    expect(result).toMatchObject({
      verdict: 'effective',
      baselineRate: '36000',
      postRate: '7200',
    });
  });

  it('D2: a post window without complete state coverage is insufficient evidence, however many hours', () => {
    const gapped: ExposureWindow = {
      ...window(0, 1000),
      knownSeconds: HOURS(1000),
      unknownSeconds: HOURS(200),
      coverage: '0.8333',
    };
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: window(5, 1000),
      correctedBaseline: null,
      post: gapped,
      criteria: CRITERIA,
    });
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons).toEqual([
      'state data covers 83.3 % of the window after the action (200 h without data); a verdict needs at least 95 % coverage',
    ]);
    const covered = effectivenessOf({
      metric: 'recurrences',
      baseline: window(5, 1000),
      correctedBaseline: null,
      post: { ...gapped, unknownSeconds: '0', coverage: '1' },
      criteria: CRITERIA,
    });
    expect(covered.verdict).toBe('effective');
  });

  const covering = (
    coverage: string,
    unknownHours: number,
  ): ExposureWindow => ({
    ...window(0, 1000),
    knownSeconds: HOURS(1000),
    unknownSeconds: HOURS(unknownHours),
    coverage,
  });
  const judged = (post: ExposureWindow, criteria = CRITERIA) =>
    effectivenessOf({
      metric: 'recurrences',
      baseline: { ...window(5, 1000), coverage: '0.9', unknownSeconds: '0' },
      correctedBaseline: null,
      post,
      criteria,
    });

  it('owner 18 Oct: 96 % coverage meets the default 95 % minimum, the verdict comes from the known exposure', () => {
    const result = judged(covering('0.96', 41.7));
    expect(result.verdict).toBe('effective');
    expect(result.reasons).toEqual(['rate reduced by 100 %']);
    expect(result.coverage).toEqual({
      baseline: '0.9',
      post: '0.96',
      minimum: '0.95',
    });
  });

  it('owner 18 Oct: 94 % coverage is insufficient evidence, the reason shows coverage against the minimum', () => {
    const result = judged(covering('0.94', 63.8));
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons).toEqual([
      'state data covers 94 % of the window after the action (63.8 h without data); a verdict needs at least 95 % coverage',
    ]);
    expect(result.coverage?.post).toBe('0.94');
  });

  it('the minimum frozen in the criteria applies; exactly at the minimum is enough', () => {
    const strict = { ...CRITERIA, minimumCoverage: 1 };
    expect(judged(covering('0.99', 10), strict).verdict).toBe(
      'insufficient_evidence',
    );
    expect(judged(covering('0.99', 10), strict).reasons[0]).toContain(
      'needs at least 100 % coverage',
    );
    const loose = { ...CRITERIA, minimumCoverage: 0.9 };
    expect(judged(covering('0.9', 111), loose).verdict).toBe('effective');
    expect(judged(covering('0.9', 111), loose).coverage?.minimum).toBe('0.9');
  });

  it('owner 18 Oct: a unit without a state mapping needs a state mapping, not more coverage', () => {
    const unmapped: ExposureWindow = {
      ...covering('0', 1000),
      exposureSeconds: '0',
      knownSeconds: '0',
      unmappedUnitIds: ['unit-1'],
    };
    const result = judged(unmapped);
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons).toEqual(['needs a state mapping for this unit']);
    expect(
      judged({ ...unmapped, unmappedUnitIds: ['unit-1', 'unit-2'] }).reasons,
    ).toEqual(['needs a state mapping for each of these 2 units']);
  });

  it('windows before rca-exposure-v3 report no coverage and are not gated', () => {
    const result = judged(window(1, 1000));
    expect(result.verdict).toBe('effective');
    expect(result.coverage).toEqual({
      baseline: '0.9',
      post: null,
      minimum: '0.95',
    });
  });
});

describe('caseEffectiveness', () => {
  it('null until verified, the worst verdict otherwise', () => {
    expect(caseEffectiveness([])).toBeNull();
    expect(caseEffectiveness(['effective', 'effective'])).toBe('effective');
    expect(caseEffectiveness(['effective', 'insufficient_evidence'])).toBe(
      'insufficient_evidence',
    );
    expect(caseEffectiveness(['insufficient_evidence', 'not_effective'])).toBe(
      'not_effective',
    );
  });
});
