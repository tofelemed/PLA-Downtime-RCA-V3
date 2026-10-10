import { isSetAction, RuleDefinition } from './grammar/rule-definition';
import { evaluateRule } from './grammar/rule-interpreter';
import { eventFacts, RuleEventSource } from './rule-event-facts';

export interface SimulatedEvent extends RuleEventSource {
  id: string;
  status?: string | null;
}

export interface SimulationChange {
  field: string;
  before: string | null;
  after: string;
}

export interface SimulationSample {
  eventId: string;
  unitId: string;
  startTime: string;
  changes: SimulationChange[];
  flags: string[];
}

/** Counts per value of one field before and after the rule (value `null` = empty). */
export interface FieldDistribution {
  before: Record<string, number>;
  after: Record<string, number>;
}

export interface RuleSimulationResults {
  evaluated: number;
  matched: number;
  /** events whose value of a set field would change */
  changed: number;
  truncated: boolean;
  budgetExceeded: number;
  maxSteps: number;
  fields: Record<string, FieldDistribution>;
  flags: Record<string, number>;
  samples: SimulationSample[];
}

/** Matching events shown in full (changed ones first). */
export const SIMULATION_SAMPLES = 25;

const VALUE_OF: Readonly<
  Record<string, (event: SimulatedEvent) => string | null | undefined>
> = {
  scheduleClass: (event) => event.scheduleClass,
  oeeComponent: (event) => event.oeeComponent,
  impactCodeId: (event) => event.impactCodeId,
  statusLabel: (event) => event.status,
};

const bump = (
  counts: Record<string, number>,
  key: string | null | undefined,
) => {
  const name = key ?? 'null';
  counts[name] = (counts[name] ?? 0) + 1;
};

function evaluateOne(definition: RuleDefinition, event: SimulatedEvent) {
  const evaluation = evaluateRule(definition, eventFacts(event));
  const changes: SimulationChange[] = [];
  const flags: string[] = [];
  for (const action of evaluation.actions) {
    if (!isSetAction(action)) {
      flags.push(action.flag);
      continue;
    }
    const before = VALUE_OF[action.set]?.(event) ?? null;
    if (before !== action.value)
      changes.push({ field: action.set, before, after: action.value });
  }
  return { evaluation, changes, flags };
}

type Outcome = ReturnType<typeof evaluateOne>;

/** Adds one event's before/after values per set field and its flags to the totals. */
function tally(
  results: RuleSimulationResults,
  event: SimulatedEvent,
  { evaluation, changes, flags }: Outcome,
): void {
  results.maxSteps = Math.max(results.maxSteps, evaluation.steps);
  if (evaluation.budgetExceeded) results.budgetExceeded += 1;
  for (const [field, distribution] of Object.entries(results.fields)) {
    const before = VALUE_OF[field]?.(event) ?? null;
    const after = changes.find((change) => change.field === field)?.after;
    bump(distribution.before, before);
    bump(distribution.after, after ?? before);
  }
  flags.forEach((flag) => bump(results.flags, flag));
  if (!evaluation.matched) return;
  results.matched += 1;
  if (changes.length > 0) results.changed += 1;
}

/**
 * Before/after of a rule over a sample of events (pure; plan 3.8 simulation): per set field the value
 * distribution before and after, flag counts, and sample diffs (changed events first). The rule is
 * shown in isolation — at event creation the user's values and the reason code's defaults still win.
 */
export function simulateOverEvents(
  definition: RuleDefinition,
  events: SimulatedEvent[],
  truncated: boolean,
): RuleSimulationResults {
  const fields = Object.fromEntries(
    definition.then
      .filter(isSetAction)
      .map((action): [string, FieldDistribution] => [
        action.set,
        { before: {}, after: {} },
      ]),
  );
  const results: RuleSimulationResults = {
    evaluated: events.length,
    matched: 0,
    changed: 0,
    truncated,
    budgetExceeded: 0,
    maxSteps: 0,
    fields,
    flags: {},
    samples: [],
  };
  const changed: SimulationSample[] = [];
  const unchanged: SimulationSample[] = [];
  for (const event of events) {
    const outcome = evaluateOne(definition, event);
    tally(results, event, outcome);
    if (!outcome.evaluation.matched) continue;
    const { changes, flags } = outcome;
    const sample = {
      eventId: event.id,
      unitId: event.unitId,
      startTime: event.startTime.toISOString(),
      changes,
      flags,
    };
    (changes.length > 0 ? changed : unchanged).push(sample);
  }
  results.samples = [...changed, ...unchanged].slice(0, SIMULATION_SAMPLES);
  return results;
}
