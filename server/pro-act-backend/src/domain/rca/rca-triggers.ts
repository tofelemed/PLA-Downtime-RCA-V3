import { RuleDefinition, RuleFacts } from '../../rules/grammar/rule-definition';
import { evaluateRule } from '../../rules/grammar/rule-interpreter';
import { RcaPolicy } from './rca-policy';

export type TriggerKind = 'duration' | 'repeat' | 'rule';
export type FiredOn = 'threshold_crossed_open' | 'closed' | 'approved';
export type TriggerOutcome =
  | 'recommended'
  | 'case_created'
  | 'suppressed_duplicate';

/** The facts of one event the trigger reads (the stored, confirmed values; never guessed). */
export interface TriggerEvent {
  eventId: string;
  occurrenceId: string | null;
  unitId: string;
  assetId: string | null;
  physicalType: string;
  scheduleClass: string;
  physicalState: string;
  eventType: string | null;
  failureMode: string | null;
  start: Date;
  end: Date | null;
  /** rule facts of the event (`eventFacts`); `durationSeconds` is null while open */
  facts: RuleFacts;
}

/** An active `rca_trigger_hint` rule version (plan 3.8). */
export interface HintRule {
  id: string;
  version: number;
  name: string;
  definition: RuleDefinition;
}

export interface TriggerContext {
  now: Date;
  policy: RcaPolicy;
  policyRef: { id: string; version: number };
  rules: readonly HintRule[];
  /** functional failures of the event's asset in the repeat window, this one included */
  recentFailures: number;
  /** RCA-07: the asset already has a case that is not closed (a repeat adds evidence to it, not a case) */
  openCaseOnAsset?: boolean;
}

export interface TriggerCandidate {
  trigger: TriggerKind;
  source: { kind: 'policy' | 'rule'; id: string; version: number };
  idempotencyKey: string;
  provisional: boolean;
  firedOn: FiredOn;
  /** advisory events can only ever recommend (T42) */
  recommendOnly: boolean;
  detail: Record<string, string | number | boolean | null>;
}

const LIVE_STATES = new Set(['open', 'closed']);

/** D13 functional failure: a `FailureWO` event or an unplanned stop with a failure code. */
export function isFunctionalFailure(event: TriggerEvent): boolean {
  if (event.eventType === 'FailureWO') return true;
  return (
    event.physicalType === 'downtime' &&
    event.scheduleClass === 'unplanned' &&
    Boolean(event.failureMode?.trim())
  );
}

/** Confirmed seconds of a closed event, elapsed seconds of an open one. */
export function triggerSeconds(event: TriggerEvent, now: Date): number {
  const end = event.end ?? now;
  return Math.max(
    0,
    Math.floor((end.getTime() - event.start.getTime()) / 1000),
  );
}

const occurrenceOf = (event: TriggerEvent) =>
  event.occurrenceId ?? event.eventId;

function durationCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  const threshold = context.policy.durationThresholdSeconds;
  if (threshold <= 0) return null;
  if (event.physicalType !== 'downtime' || event.scheduleClass !== 'unplanned')
    return null;
  const seconds = triggerSeconds(event, context.now);
  if (seconds < threshold) return null;
  const open = event.end === null;
  const ref = context.policyRef;
  return {
    trigger: 'duration',
    source: { kind: 'policy', ...ref },
    idempotencyKey: `policy:${ref.id}@${ref.version}:duration:${occurrenceOf(event)}`,
    provisional: open,
    firedOn: open ? 'threshold_crossed_open' : 'closed',
    recommendOnly: false,
    detail: { seconds, thresholdSeconds: threshold },
  };
}

function repeatCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  if (!event.assetId || !isFunctionalFailure(event)) return null;
  if (context.openCaseOnAsset) return null;
  const { repeatCount, repeatWindowDays } = context.policy;
  if (context.recentFailures < repeatCount) return null;
  const ref = context.policyRef;
  return {
    trigger: 'repeat',
    source: { kind: 'policy', ...ref },
    idempotencyKey: `policy:${ref.id}@${ref.version}:repeat:${occurrenceOf(event)}`,
    provisional: false,
    firedOn: event.end === null ? 'threshold_crossed_open' : 'closed',
    recommendOnly: false,
    detail: {
      failures: context.recentFailures,
      repeatCount,
      repeatWindowDays,
      assetId: event.assetId,
    },
  };
}

function ruleCandidates(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate[] {
  const open = event.end === null;
  const facts: RuleFacts = open
    ? { ...event.facts, durationSeconds: triggerSeconds(event, context.now) }
    : event.facts;
  return context.rules.flatMap((rule) => {
    const result = evaluateRule(rule.definition, facts);
    if (!result.matched) return [];
    return [
      {
        trigger: 'rule' as const,
        source: { kind: 'rule' as const, id: rule.id, version: rule.version },
        idempotencyKey: `rule:${rule.id}@${rule.version}:${occurrenceOf(event)}`,
        provisional: open,
        firedOn: open ? 'threshold_crossed_open' : 'closed',
        recommendOnly: event.physicalType === 'advisory',
        detail: { ruleName: rule.name },
      },
    ];
  });
}

/**
 * RCA01 trigger evaluation of one event (pure, deterministic for the same facts and `now`): the D13
 * policy thresholds (unplanned downtime duration, repeated functional failure of an asset) and the
 * tenant's active `rca_trigger_hint` rules. Open events fire on elapsed time with a provisional marker;
 * the idempotency key is `<rule or policy version>:<occurrence>`, so closure, replays and re-evaluation
 * reuse it. Retracted and superseded events never fire. The cost trigger is not evaluated here (it fires
 * on approved impact, and stays off while `costThreshold` is null — D08).
 */
export function evaluateTriggers(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate[] {
  if (!LIVE_STATES.has(event.physicalState)) return [];
  const advisory = event.physicalType === 'advisory';
  const policy = advisory
    ? []
    : [durationCandidate(event, context), repeatCandidate(event, context)];
  return [
    ...policy.filter((entry): entry is TriggerCandidate => entry !== null),
    ...ruleCandidates(event, context),
  ];
}

export interface StoredEvaluation {
  outcome: TriggerOutcome;
  provisional: boolean;
}

export type TriggerDecision =
  | { action: 'insert'; outcome: 'recommended' | 'case_created' }
  | { action: 'confirm'; outcome: 'suppressed_duplicate' }
  | { action: 'skip'; outcome: 'suppressed_duplicate' };

/**
 * What to do with a candidate given the evaluation already stored under its key: a new key records a
 * recommendation, or a case when the policy says `create` (never for advisory events); a provisional
 * evaluation becoming confirmed is confirmed in place; anything else is a suppressed duplicate.
 */
export function decideTrigger(
  candidate: TriggerCandidate,
  policy: RcaPolicy,
  existing: StoredEvaluation | null,
): TriggerDecision {
  if (!existing) {
    const create = policy.autoCreate === 'create' && !candidate.recommendOnly;
    return {
      action: 'insert',
      outcome: create ? 'case_created' : 'recommended',
    };
  }
  if (existing.provisional && !candidate.provisional) {
    return { action: 'confirm', outcome: 'suppressed_duplicate' };
  }
  return { action: 'skip', outcome: 'suppressed_duplicate' };
}
