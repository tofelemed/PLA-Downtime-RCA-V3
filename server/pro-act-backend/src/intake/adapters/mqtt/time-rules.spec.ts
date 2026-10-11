import {
  parseEventTime,
  parseRfc3339,
  resolveEventTime,
  TimeRules,
  timeRulesOf,
} from './time-rules';

const RECEIVED = new Date('2026-10-11T06:10:00.000Z');
const RULES: TimeRules = {
  unit: 'iso',
  maxFutureSkewSeconds: 300,
  maxPastSeconds: 7 * 24 * 3600,
  onStale: 'reject',
};

describe('time rules (design §4.2 stage 9, contract §3, MQ03)', () => {
  it.each([
    ['2026-10-11T06:07:14.187Z', '2026-10-11T06:07:14.187Z'],
    ['2026-10-11T08:07:14+02:00', '2026-10-11T06:07:14.000Z'],
    ['2026-10-11T06:07:14-00:00', '2026-10-11T06:07:14.000Z'],
    ['2026-10-11T06:07:14.5Z', '2026-10-11T06:07:14.500Z'],
  ])('parses RFC 3339 %s', (raw, iso) => {
    const parsed = parseRfc3339(raw);
    expect(parsed.ok && parsed.at.toISOString()).toBe(iso);
  });

  it.each([
    ['local time without offset', '2026-10-11T06:07:14.187'],
    ['a date only', '2026-10-11'],
    ['a space separator', '2026-10-11 06:07:14Z'],
    ['lower-case t and z', '2026-10-11t06:07:14z'],
    ['an offset without colon', '2026-10-11T06:07:14+0200'],
    ['an impossible month', '2026-13-11T06:07:14Z'],
    ['an epoch number', 1791440400000],
    ['a numeric string', '1791440400000'],
    ['null', null],
  ])('refuses %s', (_label, raw) => {
    expect(parseRfc3339(raw).ok).toBe(false);
  });

  it('refuses epoch integers under the contract unit iso, with a hint', () => {
    const parsed = parseEventTime(1791440400000, 'iso');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.detail).toContain('epoch integers are not allowed');
  });

  it('accepts epochs only through the explicit ms / s opt-in', () => {
    const ms = parseEventTime(1791440400000, 'ms');
    const s = parseEventTime(1791440400, 's');
    const text = parseEventTime('1791440400', 's');
    expect(ms.ok && ms.at.toISOString()).toBe('2026-10-08T06:20:00.000Z');
    expect(s.ok && s.at.toISOString()).toBe('2026-10-08T06:20:00.000Z');
    expect(text.ok && text.at.toISOString()).toBe('2026-10-08T06:20:00.000Z');
    expect(parseEventTime('2026-10-08T06:20:00Z', 'ms').ok).toBe(false);
    expect(parseEventTime(-5, 'ms').ok).toBe(false);
  });

  it('auto detects ms (13 digits), s (10 digits) and ISO strings', () => {
    const ms = parseEventTime(1791440400000, 'auto');
    const s = parseEventTime(1791440400, 'auto');
    const iso = parseEventTime('2026-10-08T06:20:00Z', 'auto');
    for (const parsed of [ms, s, iso]) {
      expect(parsed.ok && parsed.at.toISOString()).toBe(
        '2026-10-08T06:20:00.000Z',
      );
    }
    expect(parseEventTime('2026-10-08T06:20:00', 'auto').ok).toBe(false);
  });

  it('keeps an event time inside the window, not degraded', () => {
    const result = resolveEventTime(
      '2026-10-11T06:09:30.100Z',
      RECEIVED,
      RULES,
    );
    expect(result).toEqual({
      ok: true,
      at: new Date('2026-10-11T06:09:30.100Z'),
      degraded: false,
      flags: [],
    });
  });

  it('rejects an event time more than maxFutureSkewSeconds ahead (FUTURE_TIMESTAMP)', () => {
    const within = resolveEventTime(
      '2026-10-11T06:14:59.000Z',
      RECEIVED,
      RULES,
    );
    const beyond = resolveEventTime(
      '2026-10-11T06:20:00.000Z',
      RECEIVED,
      RULES,
    );
    expect(within.ok).toBe(true);
    expect(beyond).toMatchObject({ ok: false, code: 'FUTURE_TIMESTAMP' });
  });

  it('rejects or flags an event time older than maxPastSeconds per onStale', () => {
    const eightDaysAgo = '2026-10-03T06:10:00.000Z';
    expect(resolveEventTime(eightDaysAgo, RECEIVED, RULES)).toMatchObject({
      ok: false,
      code: 'STALE_TIMESTAMP',
    });
    expect(
      resolveEventTime(eightDaysAgo, RECEIVED, { ...RULES, onStale: 'flag' }),
    ).toEqual({
      ok: true,
      at: new Date(eightDaysAgo),
      degraded: true,
      flags: ['stale'],
    });
    const sixDaysAgo = '2026-10-05T06:10:00.000Z';
    expect(resolveEventTime(sixDaysAgo, RECEIVED, RULES).ok).toBe(true);
  });

  it('substitutes the receive time for a missing event time and flags it degraded', () => {
    expect(resolveEventTime(undefined, RECEIVED, RULES)).toEqual({
      ok: true,
      at: RECEIVED,
      degraded: true,
      flags: ['event_time_missing'],
    });
    expect(resolveEventTime(null, RECEIVED, RULES).ok).toBe(true);
  });

  it('reports an unparsable event time as SCHEMA_INVALID', () => {
    expect(
      resolveEventTime('2026-10-11T06:09:30', RECEIVED, RULES),
    ).toMatchObject({
      ok: false,
      code: 'SCHEMA_INVALID',
    });
  });

  it('derives the rules of a profile: contract defaults, stale handling by kind', () => {
    expect(
      timeRulesOf({ kind: 'interval_event_json', topicTemplate: 't' }),
    ).toEqual({
      unit: 'iso',
      maxFutureSkewSeconds: 300,
      maxPastSeconds: 604_800,
      onStale: 'reject',
    });
    expect(
      timeRulesOf({ kind: 'measurement_json', topicTemplate: 't' }).onStale,
    ).toBe('flag');
    expect(
      timeRulesOf({ kind: 'state_json', topicTemplate: 't' }).onStale,
    ).toBe('flag');
    expect(
      timeRulesOf({
        kind: 'measurement_json',
        topicTemplate: 't',
        time: { unit: 'ms', maxPastSeconds: 60, onStale: 'reject' },
      }),
    ).toEqual({
      unit: 'ms',
      maxFutureSkewSeconds: 300,
      maxPastSeconds: 60,
      onStale: 'reject',
    });
  });
});
