import { RuleDefinition, RuleFacts } from '../../rules/grammar/rule-definition';
import { evaluateRule } from '../../rules/grammar/rule-interpreter';
import { productionThreshold, RcaPolicy } from './rca-policy';

export type TriggerKind =
  | 'duration'
  | 'repeat'
  | 'cumulative'
  | 'consequence'
  | 'cost'
  | 'quantity'
  | 'rule';
export type FiredOn = 'threshold_crossed_open' | 'closed' | 'approved';
export type TriggerOutcome =
  | 'recommended'
  | 'case_created'
  | 'linked_to_case'
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
  /** D17 consequence markers (`sol_type`, `severity`); null when not recorded */
  solType?: string | null;
  severity?: string | null;
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
  /** same-problem incidents of the event's asset in the repeat window, this one included (CA8) */
  recentFailures: number;
  /** CA8: unplanned downtime seconds of the same asset and mode in the cumulative window, this one included */
  cumulativeSeconds?: number;
  /** D17: the event's asset is critical (production thresholds × the policy factor) */
  criticalAsset?: boolean;
  /** CA8: an open case about the same problem; same-problem firings link to it instead of a new case */
  openCaseId?: string | null;
}

export interface TriggerCandidate {
  trigger: TriggerKind;
  source: { kind: 'policy' | 'rule'; id: string; version: number };
  idempotencyKey: string;
  provisional: boolean;
  firedOn: FiredOn;
  /** advisory events can only ever recommend (T42) */
  recommendOnly: boolean;
  /** the open case this firing adds evidence to (CA8), else undefined */
  linkToCaseId?: string;
  detail: Record<string, string | number | boolean | null>;
}

const LIVE_STATES = new Set(['open', 'closed']);

/** D13 functional failure: a `FailureWO` event or an unplanned stop with a failure code. */
export function isFunctionalFailure(event: TriggerEvent): boolean {
  if (event.eventType === 'FailureWO') return true;
  return isUnplannedStop(event) && Boolean(event.failureMode?.trim());
}

export function isUnplannedStop(event: TriggerEvent): boolean {
  return (
    event.physicalType === 'downtime' && event.scheduleClass === 'unplanned'
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

export const occurrenceOf = (event: {
  occurrenceId: string | null;
  eventId: string;
}) => event.occurrenceId ?? event.eventId;

function policyCandidate(
  event: TriggerEvent,
  context: TriggerContext,
  input: {
    trigger: TriggerKind;
    provisional: boolean;
    detail: TriggerCandidate['detail'];
  },
): TriggerCandidate {
  const ref = context.policyRef;
  return {
    trigger: input.trigger,
    source: { kind: 'policy', ...ref },
    idempotencyKey: `policy:${ref.id}@${ref.version}:${input.trigger}:${occurrenceOf(event)}`,
    provisional: input.provisional,
    firedOn: event.end === null ? 'threshold_crossed_open' : 'closed',
    recommendOnly: event.physicalType === 'advisory',
    // versions before CA8 (asset matching) never linked; they suppressed the repeat only
    ...(context.openCaseId && context.policy.repeatMatch !== 'asset'
      ? { linkToCaseId: context.openCaseId }
      : {}),
    detail: { ...input.detail, criticalAsset: Boolean(context.criticalAsset) },
  };
}

function durationCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  const { policy } = context;
  if (policy.durationThresholdSeconds <= 0 || !isUnplannedStop(event))
    return null;
  const threshold = productionThreshold(
    policy,
    policy.durationThresholdSeconds,
    Boolean(context.criticalAsset),
  );
  const seconds = triggerSeconds(event, context.now);
  if (seconds < threshold) return null;
  return policyCandidate(event, context, {
    trigger: 'duration',
    provisional: event.end === null,
    detail: { seconds, thresholdSeconds: threshold },
  });
}

function repeatEligible(event: TriggerEvent, context: TriggerContext): boolean {
  if (!event.assetId) return false;
  if (context.policy.repeatMatch === 'asset') return isFunctionalFailure(event);
  return event.eventType === 'FailureWO' || isUnplannedStop(event);
}

function repeatCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  if (!repeatEligible(event, context)) return null;
  const { repeatCount, repeatWindowDays, repeatMatch } = context.policy;
  // versions before CA8: any open case on the asset swallowed the repeat
  if (repeatMatch === 'asset' && context.openCaseId) return null;
  if (context.recentFailures < repeatCount) return null;
  return policyCandidate(event, context, {
    trigger: 'repeat',
    provisional: false,
    detail: {
      failures: context.recentFailures,
      repeatCount,
      repeatWindowDays,
      repeatMatch,
      assetId: event.assetId,
    },
  });
}

function cumulativeCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  const rule = context.policy.cumulative;
  if (!rule || !event.assetId || !isUnplannedStop(event)) return null;
  const threshold = productionThreshold(
    context.policy,
    rule.downtimeSeconds,
    Boolean(context.criticalAsset),
  );
  const seconds = context.cumulativeSeconds ?? 0;
  if (seconds < threshold) return null;
  return policyCandidate(event, context, {
    trigger: 'cumulative',
    provisional: event.end === null,
    detail: {
      seconds,
      thresholdSeconds: threshold,
      windowDays: rule.windowDays,
    },
  });
}

/** D17 override: a safety / critical consequence marker fires whatever the loss (never swallowed). */
function consequenceCandidate(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate | null {
  const { solTypes, severities } = context.policy.consequence;
  const marker =
    (event.solType &&
      solTypes.includes(event.solType) &&
      `solType:${event.solType}`) ||
    (event.severity &&
      severities.includes(event.severity) &&
      `severity:${event.severity}`);
  if (!marker) return null;
  return policyCandidate(
    event,
    { ...context, openCaseId: null },
    {
      trigger: 'consequence',
      provisional: false,
      detail: { marker },
    },
  );
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
 * RCA01 / D17 any-of trigger evaluation of one event (pure, deterministic for the same facts and `now`):
 * unplanned downtime duration, same-mode repeats and cumulative same-mode downtime (CA8 bad actor) —
 * production thresholds × the critical-asset factor — the safety / consequence override, and the
 * tenant's active `rca_trigger_hint` rules. Same-problem firings carry the open case they add evidence to.
 * Open events fire on elapsed time with a provisional marker; the idempotency key is
 * `<rule or policy version>:<trigger>:<occurrence>`. Retracted and superseded events never fire. Cost and
 * lost quantity fire on approved impact (`evaluateApprovedTriggers`).
 */
export function evaluateTriggers(
  event: TriggerEvent,
  context: TriggerContext,
): TriggerCandidate[] {
  if (!LIVE_STATES.has(event.physicalState)) return [];
  const advisory = event.physicalType === 'advisory';
  const policy = advisory
    ? [consequenceCandidate(event, context)]
    : [
        durationCandidate(event, context),
        repeatCandidate(event, context),
        cumulativeCandidate(event, context),
        consequenceCandidate(event, context),
      ];
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
  | {
      action: 'insert';
      outcome: 'recommended' | 'case_created' | 'linked_to_case';
    }
  | { action: 'confirm'; outcome: 'suppressed_duplicate' }
  | { action: 'skip'; outcome: 'suppressed_duplicate' };

/**
 * What to do with a candidate given the evaluation already stored under its key: a new key links the
 * event to the open same-problem case (CA8), else records a recommendation, or a case when the policy
 * says `create` (never for advisory events); a provisional evaluation becoming confirmed is confirmed in
 * place; anything else is a suppressed duplicate.
 */
export function decideTrigger(
  candidate: TriggerCandidate,
  policy: RcaPolicy,
  existing: StoredEvaluation | null,
): TriggerDecision {
  if (!existing) {
    if (candidate.linkToCaseId)
      return { action: 'insert', outcome: 'linked_to_case' };
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
