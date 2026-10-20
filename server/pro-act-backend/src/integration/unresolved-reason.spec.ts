import type { FrameResult } from './pi-frame-ingest.service';
import { unresolvedReason } from './unresolved-reason';

const result = (diagnostics: FrameResult['diagnostics']): FrameResult => ({
  outcome: 'created',
  diagnostics,
  eventId: 'e1',
});

/** PI and MQTT park a reason token the code library lacks (integration audit 19 Oct 2026). */
describe('unresolved reason quarantine', () => {
  const unresolved = {
    code: 'CODE_UNRESOLVED',
    field: 'reason',
    message: 'No reason code matches SCREEN-CHANGE',
  };

  it('parks the delivered token under any of its attribute names', () => {
    const digital = { Name: 'SCREEN-CHANGE', Value: 61, IsSystem: false };
    expect(
      unresolvedReason(result([unresolved]), { ReasonCode: digital }),
    ).toEqual({
      errorCode: 'unknown_code',
      detail: {
        reason: unresolved.message,
        field: 'reason',
        delivered: digital,
      },
    });
    expect(
      unresolvedReason(result([unresolved]), { 'Reason Code': 'MECH-99' })
        ?.detail.delivered,
    ).toBe('MECH-99');
  });

  it('parks nothing when every code resolved', () => {
    expect(unresolvedReason(result([]), { ReasonCode: 'MECH-01' })).toBeNull();
  });
});
