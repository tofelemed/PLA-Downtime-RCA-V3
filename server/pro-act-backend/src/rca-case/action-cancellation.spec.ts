import { RcaAction } from '../rca/entities/rca-action.entity';
import { applyCancellation } from './action-cancellation';

type Fields = Pick<
  RcaAction,
  'status' | 'cancelReason' | 'cancelledBy' | 'cancelledAt'
>;

const now = new Date('2026-10-18T08:00:00Z');
const actorId = '11111111-1111-4111-8111-111111111111';
const fields = (overrides: Partial<Fields> = {}): Fields => ({
  status: 'open',
  cancelReason: null,
  cancelledBy: null,
  cancelledAt: null,
  ...overrides,
});

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return undefined;
}

describe('action cancellation (UX F-9)', () => {
  it('stamps who and when, and keeps the optional reason, when an action is cancelled', () => {
    const next = fields({ status: 'cancelled' });
    applyCancellation('open', next, {
      cancelReason: 'Superseded by the redesign',
      actorId,
      now,
    });
    expect(next).toEqual({
      status: 'cancelled',
      cancelReason: 'Superseded by the redesign',
      cancelledBy: actorId,
      cancelledAt: now,
    });
  });

  it('accepts a cancellation without a reason (current clients send none)', () => {
    const next = fields({ status: 'cancelled' });
    applyCancellation('in_progress', next, {
      cancelReason: undefined,
      actorId,
      now,
    });
    expect(next).toMatchObject({ cancelReason: null, cancelledBy: actorId });
  });

  it('lets a cancelled action get its reason later without restamping', () => {
    const earlier = new Date('2026-10-01T00:00:00Z');
    const next = fields({
      status: 'cancelled',
      cancelledBy: 'someone',
      cancelledAt: earlier,
    });
    applyCancellation('cancelled', next, {
      cancelReason: 'Duplicate of action 3',
      actorId,
      now,
    });
    expect(next).toMatchObject({
      cancelReason: 'Duplicate of action 3',
      cancelledBy: 'someone',
      cancelledAt: earlier,
    });
  });

  it('clears the cancellation when the action is reopened', () => {
    const next = fields({
      status: 'open',
      cancelReason: 'old',
      cancelledBy: actorId,
      cancelledAt: now,
    });
    applyCancellation('cancelled', next, { cancelReason: null, actorId, now });
    expect(next).toEqual(fields());
  });

  it('refuses a reason on an action that is not cancelled (422 CANCEL_REASON_WITHOUT_CANCEL)', () => {
    expect(
      errorCode(() =>
        applyCancellation('open', fields({ status: 'in_progress' }), {
          cancelReason: 'why',
          actorId,
          now,
        }),
      ),
    ).toBe('CANCEL_REASON_WITHOUT_CANCEL');
  });
});
