import * as fc from 'fast-check';
import { Dec, formatDec, ZERO } from '../decimal';
import {
  distributeOutputEvents,
  PeriodOutputEvent,
} from './output-distribution';

const at = (hhmm: string) => new Date(`2027-03-01T${hhmm}:00Z`);
const shiftA = { from: at('06:00'), to: at('14:00') };
const shiftB = { from: at('14:00'), to: at('22:00') };

const event = (
  overrides: Partial<PeriodOutputEvent> = {},
): PeriodOutputEvent => ({
  identity: 'ef-1',
  revision: 1,
  start: at('08:00'),
  end: at('10:00'),
  quantity: '100',
  rejects: null,
  uom: 't',
  ...overrides,
});

describe('distributeOutputEvents (ACT02)', () => {
  it('counts an event inside the window whole and measured; coverage is its interval', () => {
    const result = distributeOutputEvents([event()], shiftA, true);
    expect(formatDec(result.quantity ?? ZERO)).toBe('100');
    expect(formatDec(result.measured)).toBe('100');
    expect(formatDec(result.estimated)).toBe('0');
    expect(result.observed).toEqual([{ start: at('08:00'), end: at('10:00') }]);
    expect(result.reject).toBeNull();
  });

  it('counts each identity once (latest revision)', () => {
    const result = distributeOutputEvents(
      [event({ quantity: '100' }), event({ revision: 2, quantity: '120' })],
      shiftA,
      true,
    );
    expect(formatDec(result.quantity ?? ZERO)).toBe('120');
  });

  it('splits a spanning event in proportion to time, marked estimated', () => {
    const spanning = event({
      start: at('12:00'),
      end: at('16:00'),
      quantity: '80',
      rejects: '4',
    });
    const a = distributeOutputEvents([spanning], shiftA, true);
    const b = distributeOutputEvents([spanning], shiftB, true);
    expect(formatDec(a.quantity ?? ZERO)).toBe('40');
    expect(formatDec(a.estimated)).toBe('40');
    expect(formatDec(a.reject ?? ZERO)).toBe('2');
    expect(formatDec(b.quantity ?? ZERO)).toBe('40');
    expect(a.findings.map((f) => f.code)).toEqual(['proportional_estimate']);
  });

  it('books a spanning event whole at its end when estimates are not allowed, flagging both periods', () => {
    const spanning = event({
      start: at('12:00'),
      end: at('16:00'),
      quantity: '80',
    });
    const a = distributeOutputEvents([spanning], shiftA, false);
    const b = distributeOutputEvents([spanning], shiftB, false);
    expect(a.quantity).toBeNull();
    expect(a.available).toBe(true);
    expect(a.findings).toEqual([
      expect.objectContaining({ code: 'spanning_event', severity: 'problem' }),
    ]);
    expect(formatDec(b.quantity ?? ZERO)).toBe('80');
    expect(b.findings[0]).toMatchObject({
      code: 'spanning_event',
      severity: 'problem',
    });
  });

  it('uses a measured distribution when the source delivers one', () => {
    const split = event({
      start: at('12:00'),
      end: at('16:00'),
      quantity: '80',
      distribution: [
        { from: at('12:00'), to: at('14:00'), quantity: '30' },
        { from: at('14:00'), to: at('16:00'), quantity: '50' },
      ],
    });
    const a = distributeOutputEvents([split], shiftA, false);
    expect(formatDec(a.quantity ?? ZERO)).toBe('30');
    expect(formatDec(a.measured)).toBe('30');
    expect(a.findings).toEqual([]);
  });

  it('does not book open events and reports no data as null, not zero', () => {
    const open = distributeOutputEvents([event({ end: null })], shiftA, true);
    expect(open.quantity).toBeNull();
    expect(open.findings[0].code).toBe('open_output_event');
    const none = distributeOutputEvents([], shiftA, true);
    expect(none.quantity).toBeNull();
    expect(none.available).toBe(false);
  });

  it('refuses mixed quantity units', () => {
    const result = distributeOutputEvents(
      [event(), event({ identity: 'ef-2', uom: 'kg' })],
      shiftA,
      true,
    );
    expect(result.quantity).toBeNull();
    expect(result.findings.map((f) => f.code)).toContain('mixed_uom');
  });

  it('property: proportional shares over tiled windows add up to the event exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 20 * 3600 }),
        fc.array(fc.integer({ min: 1, max: 6 * 3600 }), {
          minLength: 1,
          maxLength: 6,
        }),
        (cents, durationSeconds, cuts) => {
          const quantity = new Dec(cents).div(1000);
          const start = at('00:00').getTime();
          const spanning = event({
            start: new Date(start + 1000),
            end: new Date(start + 1000 + durationSeconds * 1000),
            quantity: quantity.toString(),
          });
          let total = ZERO;
          let from = start;
          for (const cut of [...cuts, 24 * 3600]) {
            const to = from + cut * 1000;
            const share = distributeOutputEvents(
              [spanning],
              { from: new Date(from), to: new Date(to) },
              true,
            );
            total = total.plus(share.quantity ?? ZERO);
            from = to;
          }
          const covered = from - start >= durationSeconds * 1000 + 1000;
          return !covered || total.eq(quantity);
        },
      ),
    );
  });
});
