import * as fs from 'fs';
import * as path from 'path';
import { StandbyExposure } from '../../src/domain/kpi/standby-mtbf';
import {
  effectivenessOf,
  ExposureWindow,
} from '../../src/domain/rca/effectiveness';
import {
  exposureBasisOf,
  standbyRunningSeconds,
} from '../../src/domain/rca/exposure-basis';

interface Run {
  asset: string;
  start: string;
  end: string;
}

interface WindowInput {
  from: string;
  to: string;
  incidents: number;
  downtimeSeconds: string;
  unitRunSeconds: string;
  runs: Run[];
}

interface Rca04 {
  inputs: {
    criteria: {
      requiredReduction: string;
      minExposureHours: string;
      zeroRepeat: boolean;
    };
    caseAssets: string[];
    standbyAssets: string[];
    baseline: WindowInput;
    post: WindowInput;
  };
  expected: {
    basis: string;
    mixedFootprintBasis: string;
    standby: {
      baselineExposureSeconds: string;
      postExposureSeconds: string;
      verdict: string;
      reduction: string;
    };
    unitRunTime: { verdict: string };
  };
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'RCA04.json'), 'utf8'),
) as Rca04;

function standbysOf(input: WindowInput): StandbyExposure[] {
  return fixture.inputs.standbyAssets.map((assetId) => ({
    assetId,
    runs: input.runs
      .filter((run) => run.asset === assetId)
      .map((run) => ({ start: new Date(run.start), end: new Date(run.end) })),
  }));
}

function windowOf(input: WindowInput, exposureSeconds: string): ExposureWindow {
  return {
    from: input.from,
    to: input.to,
    incidents: input.incidents,
    downtimeSeconds: input.downtimeSeconds,
    exposureSeconds,
  };
}

function standbySeconds(input: WindowInput): string {
  const window = { start: new Date(input.from), end: new Date(input.to) };
  return String(standbyRunningSeconds(standbysOf(input), window, window.end));
}

const criteria = {
  requiredReduction: Number(fixture.inputs.criteria.requiredReduction),
  minExposureHours: Number(fixture.inputs.criteria.minExposureHours),
  zeroRepeat: fixture.inputs.criteria.zeroRepeat,
};

/**
 * RCA04 (CA2 / CA4, SME D9): a case about standby equipment is judged on the spares' own running time —
 * overlapping runs of two spares counted once — not on the unit run time, which is largest exactly when
 * the spares sit idle. The same history is effective on the right basis and not effective on the wrong one.
 */
describe('RCA04 effectiveness exposure of standby equipment', () => {
  const { inputs, expected } = fixture;

  it('chooses the standby basis only when every case asset is standby equipment', () => {
    expect(exposureBasisOf(inputs.caseAssets, inputs.standbyAssets)).toBe(
      expected.basis,
    );
    expect(
      exposureBasisOf([...inputs.caseAssets, 'P-101A'], inputs.standbyAssets),
    ).toBe(expected.mixedFootprintBasis);
    expect(exposureBasisOf([], inputs.standbyAssets)).toBe('unit_run_time');
  });

  it("measures the spares' running time, overlapping runs once", () => {
    expect(standbySeconds(inputs.baseline)).toBe(
      expected.standby.baselineExposureSeconds,
    );
    expect(standbySeconds(inputs.post)).toBe(
      expected.standby.postExposureSeconds,
    );
  });

  it('is effective on the standby running time and not on the unit run time', () => {
    const onStandby = effectivenessOf({
      metric: 'recurrences',
      baseline: windowOf(inputs.baseline, standbySeconds(inputs.baseline)),
      correctedBaseline: null,
      post: windowOf(inputs.post, standbySeconds(inputs.post)),
      criteria,
    });
    expect(onStandby).toMatchObject({
      verdict: expected.standby.verdict,
      reduction: expected.standby.reduction,
    });
    const onUnit = effectivenessOf({
      metric: 'recurrences',
      baseline: windowOf(inputs.baseline, inputs.baseline.unitRunSeconds),
      correctedBaseline: null,
      post: windowOf(inputs.post, inputs.post.unitRunSeconds),
      criteria,
    });
    expect(onUnit.verdict).toBe(expected.unitRunTime.verdict);
  });
});
