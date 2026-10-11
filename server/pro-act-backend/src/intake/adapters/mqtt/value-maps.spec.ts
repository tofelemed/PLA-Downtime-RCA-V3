import { PayloadProfile } from './payload-profile';
import { mapReason, mapState, mapValue, tokenOf } from './value-maps';

const STATE_MAP = {
  '1': 'running',
  '2': 'stopped',
  RUN: 'running',
  Idle: 'idle',
};

function profile(overrides: Partial<PayloadProfile> = {}): PayloadProfile {
  return { kind: 'state_json', topicTemplate: 'ot/{unit}/state', ...overrides };
}

describe('value maps (design §4.2 stage 7: no silent default)', () => {
  it.each([
    ['RUN', 'RUN'],
    [4, '4'],
    [4.0, '4'],
    [true, 'true'],
    [{ name: 'STOP', value: 0 }, 'STOP'],
    [4.5, null],
    [null, null],
    [undefined, null],
    [['RUN'], null],
    [{ value: 1 }, null],
  ])('token of %p is %p', (raw, token) => {
    expect(tokenOf(raw)).toBe(token);
  });

  it('looks integral numbers up as integer strings and digital states by name', () => {
    expect(mapValue(STATE_MAP, 1, 'state')).toMatchObject({
      ok: true,
      value: 'running',
      raw: '1',
    });
    expect(mapValue(STATE_MAP, 2.0, 'state')).toMatchObject({
      ok: true,
      value: 'stopped',
    });
    expect(
      mapValue(STATE_MAP, { name: 'RUN', value: 1 }, 'state'),
    ).toMatchObject({
      ok: true,
      value: 'running',
      raw: 'RUN',
      mapped: true,
    });
  });

  it('falls back to a case-insensitive key only when it is unambiguous', () => {
    expect(mapValue(STATE_MAP, 'idle', 'state')).toMatchObject({
      ok: true,
      value: 'idle',
    });
    expect(mapValue({ Run: 'a', RUN: 'b' }, 'run', 'state')).toMatchObject({
      ok: false,
      code: 'UNMAPPED_VALUE',
      detail: expect.stringContaining('several map keys') as string,
    });
  });

  it('rejects an unmapped token with the raw value, never a default', () => {
    expect(mapValue(STATE_MAP, 'FAULT', 'state')).toEqual({
      ok: false,
      code: 'UNMAPPED_VALUE',
      detail: 'state token "FAULT" is not in valueMaps.state (state)',
      raw: 'FAULT',
    });
    expect(mapValue(STATE_MAP, 4.5, 'state')).toMatchObject({
      ok: false,
      raw: '4.5',
    });
    expect(mapValue({}, 'RUN', 'reason')).toMatchObject({
      ok: false,
      raw: 'RUN',
    });
  });

  it('passes a state through unmapped when the profile declares no state map', () => {
    expect(mapState(profile(), { name: 'RUN', value: 1 })).toEqual({
      ok: true,
      value: 'RUN',
      raw: 'RUN',
      mapped: false,
    });
    expect(
      mapState(profile({ valueMaps: { state: STATE_MAP } }), 'FAULT').ok,
    ).toBe(false);
    expect(mapState(profile(), { value: 1 })).toMatchObject({
      ok: false,
      code: 'UNMAPPED_VALUE',
    });
  });

  it('maps reasons through valueMaps.reason and rejects unmapped ones by default', () => {
    const mapped = profile({ valueMaps: { reason: { E101: 'MECH-01' } } });
    expect(mapReason(mapped, 'E101')).toMatchObject({
      ok: true,
      value: 'MECH-01',
      mapped: true,
    });
    expect(mapReason(mapped, 'E999')).toEqual({
      ok: false,
      code: 'UNMAPPED_VALUE',
      detail: 'reason token "E999" is not in valueMaps.reason (reason)',
      raw: 'E999',
    });
  });

  it('keeps an unmapped reason raw when the profile says reasonUnmapped: keep', () => {
    const keep = profile({
      valueMaps: { reason: { E101: 'MECH-01' } },
      reasonUnmapped: 'keep',
    });
    expect(mapReason(keep, 'E999')).toEqual({
      ok: true,
      value: 'E999',
      raw: 'E999',
      mapped: false,
    });
    expect(mapReason(keep, 'E101')).toMatchObject({
      value: 'MECH-01',
      mapped: true,
    });
    expect(mapReason(profile(), 'E999')).toMatchObject({
      ok: true,
      value: 'E999',
      mapped: false,
    });
  });
});
