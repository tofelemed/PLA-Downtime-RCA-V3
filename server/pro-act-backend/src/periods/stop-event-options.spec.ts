import { OEE_POLICY_DEFAULT, parseOeePolicy } from './engine-policy-bodies';
import { PolicyBodyError } from './policy-bodies';
import { STOP_EVENT_DEFAULTS, stopEventSettings } from './stop-event-options';

describe('oee_policy stopEvents option (plan 1.10, DT-04, SME D5)', () => {
  it('a version without the option uses the pilot defaults', () => {
    const policy = parseOeePolicy(OEE_POLICY_DEFAULT);
    expect(policy.stopEvents).toBeUndefined();
    expect(stopEventSettings(policy)).toEqual({
      deriveFromState: true,
      debounceSeconds: 5,
      restartConfirmSeconds: 10,
      duplicateToleranceSeconds: 120,
      autoMergeDuplicates: true,
      incidentWindowSeconds: 120,
    });
  });

  it('stated fields override the defaults; the rest stay', () => {
    const policy = parseOeePolicy({
      ...OEE_POLICY_DEFAULT,
      stopEvents: { incidentWindowSeconds: 300, autoMergeDuplicates: false },
    });
    expect(stopEventSettings(policy)).toEqual({
      ...STOP_EVENT_DEFAULTS,
      incidentWindowSeconds: 300,
      autoMergeDuplicates: false,
    });
  });

  it.each([
    [{ debounceSeconds: -1 }],
    [{ incidentWindowSeconds: 1.5 }],
    [{ duplicateToleranceSeconds: 90_000 }],
    [{ autoMergeDuplicates: 'yes' }],
    [{ mergeEverything: true }],
    ['not an object'],
  ])('rejects %j', (stopEvents) => {
    expect(() => parseOeePolicy({ ...OEE_POLICY_DEFAULT, stopEvents })).toThrow(
      PolicyBodyError,
    );
  });
});
