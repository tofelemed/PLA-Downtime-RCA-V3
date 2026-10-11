import * as fs from 'fs';
import * as path from 'path';
import {
  LedgerTotals,
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  SliceInput,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';

/**
 * PS01: a night shift planned by two plan versions (month plans meeting at 00:00 UTC). The slices'
 * actuals are the shift output event apportioned by time; a stop and a micro-stop fall in the first
 * slice, a quality event in the second. Causes are checked and allocated over the product run.
 */
type Json = Record<string, Record<string, Record<string, string>>>;
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'PS01.json'), 'utf8'),
) as { expected: Json & { overClaimedRun: Record<string, string> } };

const SHIFT_START = Date.parse('2026-09-30T22:00:00Z');
const at = (hours: number) => new Date(SHIFT_START + hours * 3_600_000);
const dec = (value: Dec | null) => (value === null ? null : formatDec(value));

function event(
  id: string,
  physicalType: LossEvent['physicalType'],
  span: [number, number],
  quantity: string | null = null,
): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: id,
    physicalType,
    start: at(span[0]),
    end: at(span[1]),
    scheduleClass: 'unplanned',
    oeeComponent: physicalType === 'quality_loss' ? 'quality' : 'availability',
    impactMode: physicalType === 'quality_loss' ? 'none' : 'full_stop',
    impactFraction: null,
    quantity,
    reasonCodeId: null,
    impactCodeId: null,
    failureMode: null,
  };
}

function slice(
  id: string,
  window: [number, number],
  values: { target: string; gross: string; good: string },
): SliceInput {
  return {
    sliceId: id,
    productId: 'P1',
    window: { start: at(window[0]), end: at(window[1]) },
    uom: 't',
    sustainedRates: [
      { id: 'sus', rate: '100', timebase: 'h', from: at(-100), to: null },
    ],
    planningRates: [
      { id: 'plan', rate: '90', timebase: 'h', from: at(-100), to: null },
    ],
    target: values.target,
    actuals: { gross: values.gross, good: values.good, uom: 't' },
    concurrent: false,
  };
}

function input(qualityQuantity: string): PeriodAccountingInput {
  const window = { start: at(0), end: at(8) };
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    asOf: window.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    events: [
      event('stop', 'downtime', [1, 2]),
      event('micro', 'downtime', [0.5, 0.5 + 30 / 3600]),
      event('scrap', 'quality_loss', [3.25, 3.25 + 13 / 60], qualityQuantity),
    ],
    slices: [
      slice('S1', [0, 2], { target: '260', gross: '160', good: '158' }),
      slice('S2', [2, 8], { target: '560', gross: '480', good: '474' }),
    ],
  };
}

const totalsOf = (all: LedgerTotals[], sliceId: string, ledger: string) =>
  all.find((t) => t.sliceId === sliceId && t.ledger === ledger)!;
const causeLine = (
  lines: LossLineDraft[],
  query: { sliceId: string; ledger: string; eventId: string },
) =>
  lines.find(
    (l) =>
      l.sliceId === query.sliceId &&
      l.ledger === query.ledger &&
      l.cause?.eventId === query.eventId,
  );

describe('PS01 period split across plan versions (engine 2.5.1)', () => {
  const result = computePeriodAccounting(input('8'));
  const { expected } = fixture;

  it('validates: no IMPOSSIBLE_CLAIM, every identity holds', () => {
    expect(result.issues).toEqual([]);
  });

  it.each(['S1', 'S2'])('%s capacity ledger totals', (sliceId) => {
    const totals = totalsOf(result.totals, sliceId, 'capacity');
    const want = expected[sliceId].capacity;
    expect(dec(totals.capacity)).toBe(want.capacity);
    expect(dec(totals.availability)).toBe(want.availability);
    expect(dec(totals.performance)).toBe(want.performance);
    expect(dec(totals.gain)).toBe(want.gain);
    expect(dec(totals.quality)).toBe(want.quality);
    expect(dec(totals.good)).toBe(want.good);
    expect(dec(totals.residual)).toBe(want.residual);
  });

  it.each(['S1', 'S2'])('%s plan ledger totals', (sliceId) => {
    const totals = totalsOf(result.totals, sliceId, 'plan');
    const want = expected[sliceId].plan;
    expect(dec(totals.availability)).toBe(want.availability);
    expect(dec(totals.performance)).toBe(want.performance);
    expect(dec(totals.quality)).toBe(want.quality);
    expect(dec(totals.residual)).toBe(want.residual);
    expect(totals.flags).not.toContain('bridge_required');
  });

  it('the quality event is shared by the slices in proportion to gross − good', () => {
    for (const sliceId of ['S1', 'S2']) {
      const line = causeLine(result.lines, {
        sliceId,
        ledger: 'capacity',
        eventId: 'scrap',
      });
      expect(dec(line!.quantity)).toBe(
        expected[sliceId].capacity.qualityEventShare,
      );
      expect(line!.flags).toContain('product_run_share');
      expect(line!.evidence[0].eventId).toBe('scrap');
    }
  });

  it('the micro-stop claim goes where the run has performance loss', () => {
    const query = { sliceId: 'S2', eventId: 'micro' };
    const capacity = causeLine(result.lines, { ...query, ledger: 'capacity' });
    const plan = causeLine(result.lines, { ...query, ledger: 'plan' });
    expect(dec(capacity!.quantity)).toBe(expected.S2.capacity.microStopClaim);
    expect(dec(plan!.quantity)).toBe(expected.S2.plan.microStopClaim);
    expect(
      causeLine(result.lines, { ...query, sliceId: 'S1', ledger: 'capacity' }),
    ).toBeUndefined();
  });

  it('a claim beyond the whole run still fails (never scaled down)', () => {
    const { qualityEventQuantity, issue } = expected.overClaimedRun;
    const failed = computePeriodAccounting(input(qualityEventQuantity));
    const codes = failed.issues.map((i) => i.code);
    expect(codes).toContain(issue);
  });

  it('is deterministic', () => {
    const again = computePeriodAccounting(input('8'));
    expect(again.lines.map((l) => [l.autoKey, formatDec(l.quantity)])).toEqual(
      result.lines.map((l) => [l.autoKey, formatDec(l.quantity)]),
    );
  });
});
