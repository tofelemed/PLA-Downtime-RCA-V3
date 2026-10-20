import {
  coveredByDepth,
  DepthFacts,
  depthIssues,
  depthRequirementOf,
  INVESTIGATION_DEPTH,
} from './investigation-depth';
import { CONSEQUENCE_CLASSES } from './rca-policy-rules';

const EMPTY: DepthFacts = {
  consequenceClass: 'minor',
  methods: [],
  teamCharter: null,
  codedRootCauses: 0,
};
const codes = (facts: DepthFacts) =>
  depthIssues(facts).map((issue) => issue.code);
const methodsOf = (facts: DepthFacts) =>
  depthIssues(facts)
    .filter((issue) => issue.code === 'METHOD_REQUIRED')
    .map((issue) => issue.methods);

describe('investigation depth by consequence class (D-T4)', () => {
  it('has a row for every consequence class, each with independent closure', () => {
    for (const cls of CONSEQUENCE_CLASSES) {
      expect(INVESTIGATION_DEPTH[cls].independentClosure).toBe(true);
    }
  });

  it('an unclassified case gets no depth requirement (the class is asked for first)', () => {
    expect(depthRequirementOf(null)).toBeNull();
    expect(depthIssues({ ...EMPTY, consequenceClass: null })).toEqual([]);
  });

  it('minor: a 5-Why (or a deeper method), nothing else', () => {
    expect(codes(EMPTY)).toEqual(['METHOD_REQUIRED']);
    expect(methodsOf(EMPTY)).toEqual([
      ['five_why', 'fishbone', 'logic_tree', 'fault_tree'],
    ]);
    expect(codes({ ...EMPTY, methods: ['five_why'] })).toEqual([]);
    expect(codes({ ...EMPTY, methods: ['logic_tree'] })).toEqual([]);
    expect(codes({ ...EMPTY, methods: ['timeline', 'change'] })).toEqual([
      'METHOD_REQUIRED',
    ]);
  });

  it('significant (moderate): a 5-Why or fishbone (or deeper) and a team charter', () => {
    const facts: DepthFacts = { ...EMPTY, consequenceClass: 'significant' };
    expect(codes(facts)).toEqual(['METHOD_REQUIRED', 'TEAM_CHARTER_REQUIRED']);
    expect(methodsOf(facts)).toEqual([
      ['five_why', 'fishbone', 'logic_tree', 'fault_tree'],
    ]);
    expect(
      codes({ ...facts, methods: ['fishbone'], teamCharter: '  ' }),
    ).toEqual(['TEAM_CHARTER_REQUIRED']);
    expect(
      codes({ ...facts, methods: ['fishbone'], teamCharter: 'Scope: E-101' }),
    ).toEqual([]);
  });

  it('major: a logic tree or fault tree, a team charter and coded causes', () => {
    const facts: DepthFacts = { ...EMPTY, consequenceClass: 'major' };
    expect(codes(facts)).toEqual([
      'METHOD_REQUIRED',
      'TEAM_CHARTER_REQUIRED',
      'CODED_CAUSE_REQUIRED',
    ]);
    expect(methodsOf(facts)).toEqual([['logic_tree', 'fault_tree']]);
    expect(
      codes({
        ...facts,
        methods: ['fault_tree'],
        teamCharter: 'Scope',
        codedRootCauses: 1,
      }),
    ).toEqual([]);
  });

  it('critical: a logic tree plus an FMEA or fault tree, a team charter and coded causes', () => {
    const facts: DepthFacts = {
      ...EMPTY,
      consequenceClass: 'critical',
      methods: ['logic_tree'],
      teamCharter: 'Scope',
      codedRootCauses: 2,
    };
    expect(methodsOf(facts)).toEqual([['fmea', 'fault_tree']]);
    expect(codes({ ...facts, methods: ['fmea', 'fault_tree'] })).toEqual([
      'METHOD_REQUIRED',
    ]);
    expect(codes({ ...facts, methods: ['logic_tree', 'fmea'] })).toEqual([]);
  });

  it('a plant method group is covered when a depth group of the class lies inside it', () => {
    expect(
      coveredByDepth('minor', [
        'five_why',
        'fishbone',
        'logic_tree',
        'fault_tree',
        'change',
      ]),
    ).toBe(true);
    expect(coveredByDepth('significant', ['fishbone', 'logic_tree'])).toBe(
      false,
    );
    expect(coveredByDepth('critical', ['barrier', 'fault_tree', 'fmea'])).toBe(
      true,
    );
  });
});
