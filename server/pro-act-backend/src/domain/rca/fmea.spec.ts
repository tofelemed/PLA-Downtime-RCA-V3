import { actionPriority, scoreFmea } from './fmea';
import { FmeaRules, RCA_RULES_DEFAULT } from './rca-policy-rules';

const RULES = RCA_RULES_DEFAULT.fmea;
const cause = (
  occurrence: number | null,
  detection: number | null,
  id = 'c1',
) => ({
  id,
  description: 'cause',
  occurrence,
  detection,
});

describe('scoreFmea (SME CA5)', () => {
  it('CA5 example: S10 O2 D2 = RPN 40 still needs action (severity); S5 O5 D5 = 125 crosses the RPN line', () => {
    const severe = scoreFmea([{ severity: 10 }], [cause(2, 2)], RULES)
      .causes[0];
    expect(severe).toMatchObject({ rpn: 40, needsAction: true, severity: 10 });
    const moderate = scoreFmea([{ severity: 5 }], [cause(5, 5)], RULES)
      .causes[0];
    expect(moderate).toMatchObject({ rpn: 125, needsAction: true });
  });

  it('detection is per cause: two causes of one mode score differently', () => {
    const scoring = scoreFmea(
      [{ severity: 6 }],
      [cause(4, 2, 'a'), cause(4, 8, 'b')],
      RULES,
    );
    expect(scoring.causes.map((c) => c.rpn)).toEqual([48, 192]);
  });

  it('a missing rating stays null and the analysis is incomplete (no default score 5)', () => {
    const scoring = scoreFmea(
      [{ severity: 7 }, { severity: null }],
      [cause(3, null)],
      RULES,
    );
    expect(scoring.complete).toBe(false);
    expect(scoring.causes[0]).toMatchObject({
      severity: null,
      rpn: null,
      actionPriority: null,
      needsAction: null,
      missing: ['severity', 'detection'],
    });
  });

  it('no causes is incomplete; all rated is complete', () => {
    expect(scoreFmea([{ severity: 3 }], [], RULES).complete).toBe(false);
    expect(scoreFmea([{ severity: 3 }], [cause(1, 1)], RULES).complete).toBe(
      true,
    );
  });

  it('action priority follows the configured rules (first match), low otherwise', () => {
    expect(
      actionPriority(RULES.priorityRules, {
        severity: 9,
        occurrence: 4,
        detection: 1,
      }),
    ).toBe('high');
    expect(
      actionPriority(RULES.priorityRules, {
        severity: 9,
        occurrence: 1,
        detection: 1,
      }),
    ).toBe('medium');
    expect(
      actionPriority(RULES.priorityRules, {
        severity: 3,
        occurrence: 3,
        detection: 3,
      }),
    ).toBe('low');
  });

  it('with the action-priority method a high priority, not the RPN, needs action', () => {
    const ap: FmeaRules = { ...RULES, method: 'action_priority' };
    const scored = scoreFmea([{ severity: 6 }], [cause(10, 10)], ap).causes[0];
    expect(scored.rpn).toBe(600);
    expect(scored.actionPriority).toBe('medium');
    expect(scored.needsAction).toBe(false);
  });
});
