import {
  eventSourceObjectId,
  IdentityParts,
  messageIdFor,
  revisionOf,
  sampleSourceObjectId,
  sampleSourceRevision,
} from './identity';

const HASH = `sha256:${'a'.repeat(64)}`;
const PARTS: IdentityParts = {
  equipment: 'Extruder1',
  bootId: 'gw-01-2026-10-11T05:00:00Z',
  seq: 1844,
  eventId: 'EF-7f2c',
  revision: '2026-10-11T06:09:30.000Z',
  payloadHash: HASH,
  eventTime: '2026-10-11T06:09:30.100Z',
};

describe('identity strategies (design §4.2 stage 3, MQ05, contract §4)', () => {
  it('seq_boot → <equipment>:<bootId>:<seq>', () => {
    expect(messageIdFor('seq_boot', PARTS)).toEqual({
      ok: true,
      messageId: 'Extruder1:gw-01-2026-10-11T05:00:00Z:1844',
    });
    expect(messageIdFor('seq_boot', { ...PARTS, seq: 0 })).toMatchObject({
      messageId: 'Extruder1:gw-01-2026-10-11T05:00:00Z:0',
    });
  });

  it('event_id → <event_id>:<revision>', () => {
    expect(messageIdFor('event_id', PARTS)).toEqual({
      ok: true,
      messageId: 'EF-7f2c:2026-10-11T06:09:30.000Z',
    });
  });

  it('payload_hash → <sha256>:<eventTime>', () => {
    expect(messageIdFor('payload_hash', PARTS)).toEqual({
      ok: true,
      messageId: `${HASH}:2026-10-11T06:09:30.100Z`,
    });
  });

  it.each([
    ['seq_boot', { bootId: null }, 'boot_id and seq'],
    ['seq_boot', { seq: null }, 'boot_id and seq'],
    ['seq_boot', { seq: -1 }, 'boot_id and seq'],
    ['event_id', { eventId: null }, 'event_id and revision'],
    ['event_id', { revision: null }, 'event_id and revision'],
  ] as const)(
    '%s without its fields is SCHEMA_INVALID (%p)',
    (strategy, change, fields) => {
      const result = messageIdFor(strategy, { ...PARTS, ...change });
      expect(result).toEqual({
        ok: false,
        code: 'SCHEMA_INVALID',
        detail: `identityStrategy ${strategy} needs ${fields}`,
      });
    },
  );

  it('never uses the packet id: identical parts give identical ids', () => {
    expect(messageIdFor('seq_boot', PARTS)).toEqual(
      messageIdFor('seq_boot', { ...PARTS }),
    );
  });

  it('builds source object ids and revisions', () => {
    expect(eventSourceObjectId('Extruder1', 'EF-7f2c')).toBe(
      'Extruder1:EF-7f2c',
    );
    expect(
      sampleSourceObjectId('ot/u1/state', '2026-10-11T06:09:30.100Z'),
    ).toBe('ot/u1/state@2026-10-11T06:09:30.100Z');
    const received = new Date('2026-10-11T06:10:00.000Z');
    expect(sampleSourceRevision(1844, received)).toBe('1844');
    expect(sampleSourceRevision(null, received)).toBe(
      String(received.getTime()),
    );
    expect(sampleSourceRevision(undefined, received)).toBe(
      String(received.getTime()),
    );
  });

  it('reads a revision as the source sent it', () => {
    expect(revisionOf('2026-10-11T06:09:30.000Z')).toBe(
      '2026-10-11T06:09:30.000Z',
    );
    expect(revisionOf(7)).toBe('7');
    expect(revisionOf('')).toBeNull();
    expect(revisionOf(1.5)).toBeNull();
    expect(revisionOf(undefined)).toBeNull();
  });
});
