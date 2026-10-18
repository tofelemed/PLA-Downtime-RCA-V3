import { describe, expect, it } from 'vitest';
import type { RcaPolicyRules } from './rca-policy-api';
import { rulesDraftOf, rulesInputOf } from './rca-policy-rules-draft';

const RULES: RcaPolicyRules = {
  effectiveness: { baselineLookbackDays: 90, minExposureHours: 720, requiredReduction: 0.5, reviewDays: 90, zeroRepeatClasses: ['major'], minimumCoverage: 0.95 },
  fmea: { method: 'rpn', rpnThreshold: 100, severityReview: 9, priorityRules: [{ priority: 'high', severityMin: 9, occurrenceMin: 4, detectionMin: 1 }] },
  fiveWhy: { guidelineLevels: 5, minLevels: 1, evidencePerLevel: true, unsupportedRootCauses: ['operator error', 'human error'] },
  investigation: {
    minor: { methodGroups: [['five_why', 'fishbone']], minTeamMembers: 0 },
    significant: { methodGroups: [['timeline'], ['fishbone', 'logic_tree']], minTeamMembers: 2 },
    major: { methodGroups: [['timeline'], ['barrier', 'fmea']], minTeamMembers: 3 },
  },
};

describe('RCA policy workflow rules form (effectiveness, FMEA, 5-Why, methods)', () => {
  it('round-trips the version in force and keeps the FMEA priority table', () => {
    expect(rulesInputOf(rulesDraftOf(RULES), RULES)).toEqual(RULES);
  });

  it('sends edited values; an out-of-range value blocks saving (the server validates again)', () => {
    const draft = { ...rulesDraftOf(RULES), minExposureHours: '600', requiredReductionPercent: '40', methodGroups: { ...rulesDraftOf(RULES).methodGroups, minor: 'five_why\nfishbone, change' } };
    const input = rulesInputOf(draft, RULES);
    expect(input?.effectiveness).toMatchObject({ minExposureHours: 600, requiredReduction: 0.4 });
    expect(input?.investigation.minor.methodGroups).toEqual([['five_why'], ['fishbone', 'change']]);
    expect(rulesInputOf({ ...draft, severityReview: '11' }, RULES)).toBeNull();
    expect(rulesInputOf({ ...draft, minExposureHours: '' }, RULES)).toBeNull();
  });

  it('edits the minimum state-data coverage as a percent (0–100); a version without it shows the 95 % default', () => {
    const draft = rulesDraftOf(RULES);
    expect(draft.minimumCoveragePercent).toBe('95');
    expect(rulesInputOf({ ...draft, minimumCoveragePercent: '97.5' }, RULES)?.effectiveness.minimumCoverage).toBe(0.975);
    expect(rulesInputOf({ ...draft, minimumCoveragePercent: '0' }, RULES)?.effectiveness.minimumCoverage).toBe(0);
    expect(rulesInputOf({ ...draft, minimumCoveragePercent: '101' }, RULES)).toBeNull();
    expect(rulesInputOf({ ...draft, minimumCoveragePercent: '' }, RULES)).toBeNull();
    const older = { ...RULES.effectiveness, minimumCoverage: undefined };
    expect(rulesDraftOf({ ...RULES, effectiveness: older }).minimumCoveragePercent).toBe('95');
  });
});
