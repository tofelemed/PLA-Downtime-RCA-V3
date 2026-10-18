import { CloseAction, closeReadiness } from './close-gate';

const action = (overrides: Partial<CloseAction> = {}): CloseAction => ({
  status: 'done',
  hasEvidence: true,
  verificationPlanned: true,
  verdict: 'effective',
  ...overrides,
});

const READY = {
  rootCause: 'Seal flush inadequate',
  actions: [action()],
  residualRisk: 'None beyond the monitored PM task',
};

describe('closeReadiness (RCA-01 / SME CA1, CA2, CA4)', () => {
  it('a verified, evidenced case with residual risk disposed is ready', () => {
    expect(closeReadiness(READY)).toEqual({
      blockers: [],
      effectiveness: 'effective',
    });
  });

  it('CA1 example: replacing the seal is not enough while effectiveness is still monitored', () => {
    const result = closeReadiness({
      ...READY,
      actions: [action({ verdict: null })],
    });
    expect(result.blockers).toEqual(['EFFECTIVENESS_NOT_VERIFIED']);
    expect(result.effectiveness).toBeNull();
  });

  it('open actions, done without evidence, no root cause or residual risk all block', () => {
    const result = closeReadiness({
      rootCause: ' ',
      actions: [
        action({ status: 'open', verdict: null }),
        action({ hasEvidence: false }),
      ],
      residualRisk: null,
    });
    expect(result.blockers).toEqual([
      'ROOT_CAUSE_MISSING',
      'ACTIONS_NOT_DONE',
      'ACTION_EVIDENCE_MISSING',
      'EFFECTIVENESS_NOT_VERIFIED',
      'RESIDUAL_RISK_MISSING',
    ]);
  });

  it('a not-effective verdict can go to the independent reviewer (with residual risk)', () => {
    const result = closeReadiness({
      ...READY,
      actions: [action({ verdict: 'not_effective' })],
    });
    expect(result).toEqual({ blockers: [], effectiveness: 'not_effective' });
  });

  it('cancelled actions neither block nor count as verified', () => {
    const result = closeReadiness({
      ...READY,
      actions: [action({ status: 'cancelled', verdict: null }), action()],
    });
    expect(result.blockers).toEqual([]);
    expect(
      closeReadiness({
        ...READY,
        actions: [action({ status: 'cancelled', verdict: null })],
      }).blockers,
    ).toEqual(['EFFECTIVENESS_NOT_VERIFIED']);
  });

  describe('item 7: coded root cause for cases opened since typed causes', () => {
    it('needs a coded root cause instead of the free text', () => {
      const coded = { coded: true, codedRootCauses: 0 };
      expect(
        closeReadiness({ ...READY, rootCauseRule: coded }).blockers,
      ).toEqual(['CODED_ROOT_CAUSE_MISSING']);
      expect(
        closeReadiness({
          ...READY,
          rootCause: null,
          rootCauseRule: { coded: true, codedRootCauses: 1 },
        }).blockers,
      ).toEqual([]);
    });

    it('older cases keep the free-text rule', () => {
      const legacy = { coded: false, codedRootCauses: 0 };
      expect(
        closeReadiness({ ...READY, rootCauseRule: legacy }).blockers,
      ).toEqual([]);
      expect(
        closeReadiness({ ...READY, rootCause: '', rootCauseRule: legacy })
          .blockers,
      ).toEqual(['ROOT_CAUSE_MISSING']);
    });
  });
});
