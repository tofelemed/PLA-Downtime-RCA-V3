import { Dec, formatDec, ZERO } from '../actuals/decimal';
import { LossKind } from '../accounting/accounting.types';
import { sumOf } from '../accounting/claims';
import {
  CandidateOutcome,
  LineAction,
  WorkflowIssue,
} from './reconciliation.types';

/** A candidate of the run with the event that caused it (`loss_lines.cause_event_id`). */
export interface EventCandidate {
  autoKey: string;
  eventId: string | null;
  kind: LossKind;
  quantity: Dec;
}

/** A saved line as the conservation check needs it. */
export interface ClaimLine {
  action: LineAction;
  autoKey: string | null;
  sliceId: string;
  kind: LossKind | null;
  quantity: Dec | null;
  eventIds: readonly string[];
}

/** Kinds that claim an event's physical loss; a gain never raises it (SME R9), bridges are not event claims. */
const CLAIMING_KINDS: ReadonlySet<string> = new Set([
  'availability',
  'performance',
  'quality',
  'transition_allowance',
  'transition_excess',
]);

/** One budget per event and kind: each kind is its own quantity basis (restart scrap is not downtime loss). */
const keyOf = (eventId: string, kind: LossKind | null) => `${eventId}|${kind}`;
const eventOfKey = (key: string) => key.slice(0, key.indexOf('|'));

interface EventLedger {
  /** the event's loss of a kind in this period: Σ its candidates of that kind in the run */
  cap: Map<string, Dec>;
  /** what the run's candidates (as decided) and their replacements already claim of it */
  claimed: Map<string, Dec>;
}

const add = (map: Map<string, Dec>, key: string, amount: Dec) =>
  map.set(key, (map.get(key) ?? ZERO).plus(amount));

/**
 * Declared mode: a production loss event's loss is its shortfall (its `quantity`), not a sum of run
 * candidates — the OT figure is the authority, the run only splits it by reason. Its budget of every
 * claiming kind is the shortfall, whether or not the run produced a candidate of that kind.
 */
function capDeclared(
  ledger: EventLedger,
  lines: readonly ClaimLine[],
  shortfalls: ReadonlyMap<string, Dec>,
): void {
  const keys = [...ledger.cap.keys()].map((key) => [eventOfKey(key), key]);
  for (const [eventId, key] of keys) {
    const shortfall = shortfalls.get(eventId);
    if (shortfall) ledger.cap.set(key, shortfall);
  }
  for (const line of lines) {
    if (line.action !== 'manual' || !CLAIMING_KINDS.has(line.kind ?? ''))
      continue;
    for (const eventId of line.eventIds) {
      const shortfall = shortfalls.get(eventId);
      if (shortfall) ledger.cap.set(keyOf(eventId, line.kind), shortfall);
    }
  }
}

function ledgerOf(
  candidates: readonly EventCandidate[],
  outcomes: readonly CandidateOutcome[],
  lines: readonly ClaimLine[],
  shortfalls: ReadonlyMap<string, Dec>,
): EventLedger {
  const ledger: EventLedger = { cap: new Map(), claimed: new Map() };
  const eventOf = new Map<string, string>();
  const effective = new Map(
    outcomes.map((o) => [o.autoKey, o.effectiveQuantity]),
  );
  for (const c of candidates) {
    if (!c.eventId || !CLAIMING_KINDS.has(c.kind)) continue;
    eventOf.set(c.autoKey, c.eventId);
    const key = keyOf(c.eventId, c.kind);
    add(ledger.cap, key, c.quantity);
    add(ledger.claimed, key, effective.get(c.autoKey) ?? c.quantity);
  }
  for (const line of lines) {
    const eventId = line.autoKey ? eventOf.get(line.autoKey) : undefined;
    if (line.action === 'replace' && eventId && line.quantity)
      add(ledger.claimed, keyOf(eventId, line.kind), line.quantity);
  }
  capDeclared(ledger, lines, shortfalls);
  return ledger;
}

/** Events joined by a manual line citing several of them are one budget (their joint loss). */
function groupsOf(
  lines: readonly ClaimLine[],
  cap: ReadonlyMap<string, Dec>,
): Array<{ events: Set<string>; lines: number[] }> {
  const groups: Array<{ events: Set<string>; lines: number[] }> = [];
  lines.forEach((line, index) => {
    if (line.action !== 'manual' || !CLAIMING_KINDS.has(line.kind ?? ''))
      return;
    const events = line.eventIds
      .map((e) => keyOf(e, line.kind))
      .filter((key) => cap.has(key));
    if (!events.length) return;
    const joined = groups.filter((g) => events.some((e) => g.events.has(e)));
    const merged = {
      events: new Set([...events, ...joined.flatMap((g) => [...g.events])]),
      lines: [...joined.flatMap((g) => g.lines), index].sort((a, b) => a - b),
    };
    groups.splice(
      0,
      groups.length,
      ...groups.filter((g) => !joined.includes(g)),
      merged,
    );
  });
  return groups;
}

/**
 * Event-level conservation of a draft save (SME R10, RC-04): the manual lines of a kind citing an event, with
 * what the run's candidates of that kind still claim of it, never exceed the event's loss of that kind in this period (each period holds
 * its own segment of an event, so splits across periods stay within the event total). Lines are taken in
 * order and the first one that goes beyond is reported with what was still available. An event the run
 * computed no loss of that kind for has no authoritative total and is not capped — except a declared
 * `production_loss` event, whose total is its shortfall.
 */
export function eventConservationIssues(input: {
  candidates: readonly EventCandidate[];
  outcomes: readonly CandidateOutcome[];
  lines: readonly ClaimLine[];
  epsilon: Dec;
  /** declared mode: shortfall (event quantity) by `production_loss` event id; absent = none cited */
  shortfalls?: ReadonlyMap<string, Dec>;
}): WorkflowIssue[] {
  const ledger = ledgerOf(
    input.candidates,
    input.outcomes,
    input.lines,
    input.shortfalls ?? new Map(),
  );
  const issues: WorkflowIssue[] = [];
  for (const group of groupsOf(input.lines, ledger.cap)) {
    const events = [...group.events];
    const cap = sumOf(events.map((e) => ledger.cap.get(e) ?? ZERO));
    let running = sumOf(events.map((e) => ledger.claimed.get(e) ?? ZERO));
    for (const index of group.lines) {
      const line = input.lines[index];
      const amount = line.quantity ?? ZERO;
      if (running.plus(amount).gt(cap.plus(input.epsilon))) {
        issues.push({
          code: 'EVENT_OVER_ALLOCATED',
          message: `line ${index} claims more of event ${events.map(eventOfKey).join(', ')} than its ${line.kind} loss in this period`,
          sliceId: line.sliceId,
          line: index,
          expectedRemainingAllocation: formatDec(
            Dec.max(cap.minus(running), ZERO),
          ),
        });
        break;
      }
      running = running.plus(amount);
    }
  }
  return issues;
}
