import {
  StopForVerification,
  uncodedVerificationReset,
  validateRefusal,
  verificationReset,
  verifyRefusal,
} from './coding-verification';

const stop: StopForVerification = {
  isStop: true,
  reasonCodeId: 'r1',
  investigationPending: false,
  verifiedAt: null,
  validatedAt: null,
  hasFailureDetail: true,
  codedBy: 'operator',
};
const at = new Date('2026-10-15T06:00:00Z');

/** SME D13: operator enters → supervisor verifies → maintenance validates the failure detail. */
describe('coding verification (SME D13)', () => {
  it('a supervisor verifies a coded or investigation-pending stop of someone else', () => {
    expect(verifyRefusal(stop, 'supervisor')).toBeNull();
    expect(
      verifyRefusal(
        { ...stop, reasonCodeId: null, investigationPending: true },
        'supervisor',
      ),
    ).toBeNull();
  });

  it('never an uncoded stop, a non-stop, a verified stop or the own coding', () => {
    expect(verifyRefusal({ ...stop, reasonCodeId: null }, 'supervisor')).toBe(
      'NOT_CODED',
    );
    expect(verifyRefusal({ ...stop, isStop: false }, 'supervisor')).toBe(
      'NOT_A_STOP',
    );
    expect(verifyRefusal({ ...stop, verifiedAt: at }, 'supervisor')).toBe(
      'ALREADY_VERIFIED',
    );
    expect(verifyRefusal(stop, 'operator')).toBe('OWN_CODING');
  });

  it('maintenance validates failure detail only after verification', () => {
    expect(validateRefusal(stop, 'maintenance')).toBe('NOT_VERIFIED');
    const verified = { ...stop, verifiedAt: at };
    expect(validateRefusal(verified, 'maintenance')).toBeNull();
    expect(
      validateRefusal({ ...verified, hasFailureDetail: false }, 'maintenance'),
    ).toBe('NO_FAILURE_DETAIL');
    expect(
      validateRefusal({ ...verified, validatedAt: at }, 'maintenance'),
    ).toBe('ALREADY_VALIDATED');
    expect(validateRefusal(verified, 'operator')).toBe('OWN_CODING');
  });

  it('SuperAdmin verifies and validates their own coding without skipping prerequisites', () => {
    expect(verifyRefusal(stop, 'operator', true)).toBeNull();
    expect(
      validateRefusal({ ...stop, verifiedAt: at }, 'operator', true),
    ).toBeNull();
    expect(
      verifyRefusal({ ...stop, reasonCodeId: null }, 'operator', true),
    ).toBe('NOT_CODED');
    expect(validateRefusal(stop, 'operator', true)).toBe('NOT_VERIFIED');
    expect(
      validateRefusal(
        { ...stop, verifiedAt: at, hasFailureDetail: false },
        'operator',
        true,
      ),
    ).toBe('NO_FAILURE_DETAIL');
  });

  it('a coding change clears the verification, a failure-detail change the validation', () => {
    expect(verificationReset(['reasonCodeId'])).toEqual({
      verifiedBy: null,
      verifiedAt: null,
    });
    expect(verificationReset(['failureCause'])).toEqual({
      validatedBy: null,
      validatedAt: null,
    });
    expect(verificationReset(['description'])).toEqual({});
  });
});

describe('uncodedVerificationReset (Marun regression R1)', () => {
  it('clears the verification when the coding becomes uncoded', () => {
    expect(
      uncodedVerificationReset(
        { codingState: 'coded' },
        { codingState: 'uncoded' },
      ),
    ).toEqual({ verifiedBy: null, verifiedAt: null });
  });

  it('keeps it otherwise', () => {
    expect(
      uncodedVerificationReset(
        { codingState: 'coded' },
        { codingState: 'coded' },
      ),
    ).toEqual({});
    expect(
      uncodedVerificationReset(
        { codingState: 'uncoded' },
        { codingState: 'uncoded' },
      ),
    ).toEqual({});
    expect(uncodedVerificationReset({ codingState: 'coded' }, {})).toEqual({});
  });
});
