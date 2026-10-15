import { Dec, ZERO } from '../actuals/decimal';
import { ratePerSecond } from '../profiles/rate-math';
import { ms } from './economic-parts';
import { normUom } from './rate-pieces';
import {
  ReworkLotSnapshot,
  ReworkRecoverySnapshot,
  ValuationContext,
  ValuationLineInput,
} from './valuation.types';

/** Whether rework capacity at an instant displaces a sale: charged, not charged, or unknown (reason). */
export type DemandAt = (at: Date) => { charged: boolean } | { reason: string };

/**
 * What happened physically to the reworked quantity of one rework line (SME V2 / E3): how much was not
 * recovered (yield loss) and how much prime output its rework time displaced at a demand-constrained unit.
 */
export interface ReworkOutcome {
  /** reworked tonnes not recovered: recorded recoveries first, the approved yield for the rest */
  lost: Dec;
  /** prime output displaced by rework time where demand was constrained */
  displaced: Dec;
  notes: string[];
}

interface LotShare {
  lot: ReworkLotSnapshot;
  /** the line's share of the lot (time share of the lot interval inside the line, 1 for an instant line) */
  share: Dec;
}

const dec = (value: string) => new Dec(value);

function shareOf(lot: ReworkLotSnapshot, line: ValuationLineInput): Dec {
  const from = ms(lot.start);
  const to = ms(lot.end);
  const start = line.start.getTime();
  const end = line.end.getTime();
  if (end <= start) return from <= start && to > start ? dec('1') : ZERO;
  const inside = Math.min(to, end) - Math.max(from, start);
  return inside > 0 ? new Dec(inside).div(to - from) : ZERO;
}

/** Rework lots of the line's product overlapping it, in its unit (units are never converted). */
function lotsOf(
  line: ValuationLineInput,
  context: ValuationContext,
): LotShare[] {
  const uom = normUom(line.uom ?? '');
  return (context.reworkLots ?? [])
    .filter(
      (lot) => lot.productId === line.productId && normUom(lot.uom) === uom,
    )
    .map((lot) => ({ lot, share: shareOf(lot, line) }))
    .filter((l) => l.share.gt(ZERO));
}

const recoveredOf = (lot: ReworkLotSnapshot) => {
  const sum = lot.recoveries.reduce((s, r) => s.plus(r.quantity), ZERO);
  const held = dec(lot.quantity);
  return sum.gt(held) ? held : sum;
};

function yieldAt(
  line: ValuationLineInput,
  context: ValuationContext,
): Dec | null {
  const at = line.start.getTime();
  const found = (context.reworkYields ?? []).find(
    (y) => y.profileId === line.profileId && ms(y.from) <= at && ms(y.to) > at,
  );
  return found ? dec(found.value) : null;
}

function perSecondAt(
  line: ValuationLineInput,
  context: ValuationContext,
  at: number,
): Dec | null {
  const found = (context.plannedRates ?? []).find(
    (r) => r.profileId === line.profileId && ms(r.from) <= at && ms(r.to) > at,
  );
  return found ? ratePerSecond(found) : null;
}

interface Recorded {
  /** reworked tonnes of the line whose recovery is recorded */
  known: Dec;
  lost: Dec;
  /** (recovery, weight) pairs: the line's share of each recorded recovery */
  recoveries: Array<{ recovery: ReworkRecoverySnapshot; weight: Dec }>;
}

/** Recorded recoveries (E3 movements) of the line's lots, scaled to the line's quantity when the lots hold more. */
function recordedOf(
  line: ValuationLineInput,
  lots: readonly LotShare[],
): Recorded {
  const withRecovery = lots.filter((l) => l.lot.recoveries.length > 0);
  const held = withRecovery.reduce(
    (s, l) => s.plus(dec(l.lot.quantity).mul(l.share)),
    ZERO,
  );
  if (held.lte(ZERO)) return { known: ZERO, lost: ZERO, recoveries: [] };
  const known = held.gt(line.quantity) ? line.quantity : held;
  const scale = known.div(held);
  const recovered = withRecovery
    .reduce((s, l) => s.plus(recoveredOf(l.lot).mul(l.share)), ZERO)
    .mul(scale);
  return {
    known,
    lost: known.minus(recovered),
    recoveries: withRecovery.flatMap((l) =>
      l.lot.recoveries.map((recovery) => ({
        recovery,
        weight: l.share.mul(scale),
      })),
    ),
  };
}

type Displaced = { quantity: Dec; notes: string[] } | { reason: string };

/** Output the recorded reprocessing time displaced: its duration × the planned rate, on the lot's own unit only. */
function recordedDisplacement(
  line: ValuationLineInput,
  context: ValuationContext,
  recorded: Recorded,
  demandAt: DemandAt,
): Displaced {
  let quantity = ZERO;
  const notes = new Set<string>();
  for (const { recovery, weight } of recorded.recoveries) {
    if (!recovery.sameUnit) notes.add('displaced_rework_other_unit');
    else if (recovery.remeasured) notes.add('displaced_output_in_ledger');
    else {
      const start = ms(recovery.start);
      const demand = demandAt(new Date(start));
      if ('reason' in demand) return demand;
      const perSecond = perSecondAt(line, context, start);
      if (!demand.charged) notes.add('displaced_not_constrained');
      else if (!perSecond) return { reason: 'planned_rate_missing' };
      else {
        const seconds = new Dec(ms(recovery.end) - start).div(1000).mul(weight);
        quantity = quantity.plus(seconds.mul(perSecond));
      }
    }
  }
  return { quantity, notes: [...notes] };
}

/**
 * SME V2 / E3 (2.8.0): the yield loss and displaced output of a rework line. Recorded recovery movements
 * of the line's rework lots say what came back (lost = reworked − recovered); the rest of the line uses
 * the product's approved rework yield (lost = rest × (1 − yield)), and without one its yield loss stays
 * out (note `no_rework_yield_rate`). Displaced output: recorded reprocessing on the lot's unit = its
 * duration × the planned rate where demand was constrained then; reprocessing measured again at the
 * boundary is already lost output of the ledger (`displaced_output_in_ledger`), reprocessing on another
 * unit does not use this capacity; unrecorded rework is assumed to run at the planned rate, displacing
 * its own tonnes (`rework_time_estimated`). Not constrained → zero, note `displaced_not_constrained`.
 */
export function reworkOutcome(
  line: ValuationLineInput,
  context: ValuationContext,
  demandAt: DemandAt,
): ReworkOutcome | { reason: string } {
  const recorded = recordedOf(line, lotsOf(line, context));
  const rest = line.quantity.minus(recorded.known);
  const notes: string[] = recorded.known.gt(ZERO)
    ? ['rework_recovery_recorded']
    : [];
  let lost = recorded.lost;
  if (rest.gt(ZERO)) {
    const rate = yieldAt(line, context);
    if (rate) lost = lost.plus(rest.mul(new Dec(1).minus(rate)));
    notes.push(rate ? 'rework_yield_rate' : 'no_rework_yield_rate');
  }
  const displaced = recordedDisplacement(line, context, recorded, demandAt);
  if ('reason' in displaced) return displaced;
  notes.push(...displaced.notes);
  let quantity = displaced.quantity;
  if (rest.gt(ZERO)) {
    const demand = demandAt(line.start);
    if ('reason' in demand) return demand;
    if (demand.charged) quantity = quantity.plus(rest);
    notes.push(
      demand.charged ? 'rework_time_estimated' : 'displaced_not_constrained',
    );
  }
  return { lost, displaced: quantity, notes: [...new Set(notes)] };
}
