import { investigationGate, InvestigationFacts } from './investigation-gate';
import { RCA_RULES_DEFAULT } from './rca-policy-rules';

const RULES = {
  investigation: RCA_RULES_DEFAULT.investigation,
  fiveWhy: RCA_RULES_DEFAULT.fiveWhy,
};
const level = (
  answer: string,
  justification: string | null = 'inspection report',
) => ({
  answer,
  justification,
});

/** CA6 belt example: three substantive, evidenced levels are enough. */
const BELT: InvestigationFacts = {
  consequenceClass: 'minor',
  rootCause:
    'Contamination protection and inspection of the tensioner were inadequate',
  teamSize: 1,
  methods: ['five_why'],
  teamCharter: null,
  codedRootCauses: 0,
  fiveWhy: {
    levels: [
      level('Belt slips because tension is low'),
      level('Tension is low because the tensioner is seized'),
      level(
        'It seized because contamination protection and inspection were inadequate',
      ),
    ],
    rootCause:
      'Contamination protection and inspection of the tensioner were inadequate',
  },
  fmea: null,
  actionCount: 1,
};

const codes = (facts: InvestigationFacts) =>
  investigationGate(facts, RULES).blockers.map((issue) => issue.code);

describe('investigationGate (SME CA1 / CA5 / CA6 / CA7)', () => {
  it('CA6 example: three evidenced levels pass; fewer than five is advice, not a block', () => {
    const result = investigationGate(BELT, RULES);
    expect(result.blockers).toEqual([]);
    expect(result.advice.map((issue) => issue.code)).toEqual([
      'FIVE_WHY_BELOW_GUIDELINE',
    ]);
  });

  it('a why without evidence blocks', () => {
    const fiveWhy = {
      ...BELT.fiveWhy!,
      levels: [level('x'), level('y', null)],
    };
    expect(codes({ ...BELT, fiveWhy })).toEqual(['FIVE_WHY_EVIDENCE_MISSING']);
  });

  it('an unsupported "operator error" is not accepted as the root cause', () => {
    const blocked = codes({
      ...BELT,
      rootCause: 'Operator error.',
      fiveWhy: { ...BELT.fiveWhy!, rootCause: 'operator error' },
    });
    expect(blocked).toEqual(['ROOT_CAUSE_MISSING', 'FIVE_WHY_ROOT_CAUSE']);
  });

  it('CA7 + D-T4: a significant case needs a timeline, fishbone or logic tree, a causal chain, a charter and a team of 2', () => {
    const blocked = codes({ ...BELT, consequenceClass: 'significant' });
    expect(blocked).toEqual([
      'METHOD_MISSING',
      'METHOD_MISSING',
      'TEAM_CHARTER_REQUIRED',
      'TEAM_TOO_SMALL',
    ]);
    expect(
      codes({
        ...BELT,
        consequenceClass: 'significant',
        teamSize: 2,
        methods: ['timeline', 'fishbone', 'five_why'],
        teamCharter: 'Find why the belt slips; lead, fitter, operator',
      }),
    ).toEqual([]);
  });

  it('D-T4: a major case needs a logic tree or fault tree (a barrier analysis alone is not enough), a charter and coded causes', () => {
    const major: InvestigationFacts = {
      ...BELT,
      consequenceClass: 'major',
      teamSize: 3,
      methods: ['timeline', 'barrier', 'five_why'],
    };
    expect(codes(major)).toEqual([
      'METHOD_REQUIRED',
      'TEAM_CHARTER_REQUIRED',
      'CODED_CAUSE_REQUIRED',
    ]);
    expect(
      codes({
        ...major,
        methods: ['timeline', 'barrier', 'logic_tree', 'five_why'],
        teamCharter: 'Gearbox trips',
        codedRootCauses: 1,
      }),
    ).toEqual([]);
  });

  it('D-T4: a minor case needs a 5-Why or deeper method; the plant tier it covers is not repeated', () => {
    const result = investigationGate(
      { ...BELT, methods: [], fiveWhy: null },
      RULES,
    );
    expect(result.blockers.map((issue) => issue.code)).toEqual([
      'METHOD_REQUIRED',
    ]);
    expect(result.blockers[0].methods).toEqual([
      'five_why',
      'fishbone',
      'logic_tree',
      'fault_tree',
    ]);
  });

  it('the consequence class, an incomplete FMEA and no action block', () => {
    expect(
      codes({
        ...BELT,
        consequenceClass: null,
        fmea: { complete: false },
        actionCount: 0,
      }),
    ).toEqual([
      'CONSEQUENCE_CLASS_MISSING',
      'FMEA_INCOMPLETE',
      'ACTIONS_MISSING',
    ]);
  });
});
