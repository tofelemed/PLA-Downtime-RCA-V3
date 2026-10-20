import { Dec, formatDec } from '../actuals/decimal';
import {
  EffectivenessVerdict,
  ExposureWindow,
  ratePer1000Hours,
} from './effectiveness';
import { ExposureBasis } from './exposure-basis';
import { ActionBaseline, approvedCorrection } from './rca-verification';

/** Version of the watch rule below, part of each recommendation's idempotency key and detail. */
export const RECURRENCE_WATCH_VERSION = 'rca-watch-v1';
/** D-T3 (owner, 19 Oct 2026): a closed case is watched for 180 days after its closure. */
export const RECURRENCE_WATCH_DAYS = 180;
/** Trigger kind of the recommendation the watch records (`rca_trigger_evaluations.trigger`). */
export const REEVALUATE_TRIGGER = 'reevaluate';

const HOUR = 3600;
const DAY_MS = 86_400_000;
const PER = 1000;

/** An action of the closed case as the watch reads it (its frozen CA3 baseline and CA2 verdict). */
export interface WatchedAction {
  id: string;
  status: string;
  baseline: ActionBaseline | null;
  /** the verification verdict; null while the action was not verified */
  verdict: EffectivenessVerdict | null;
}

/** The case's frozen baseline the watch compares against: one verified action's pre-action rate. */
export interface WatchBaseline {
  actionId: string;
  /** same-mode unplanned incidents per 1,000 run hours before the action */
  rate: Dec;
  /** the run-time basis frozen with that baseline (standby-aware, CA4) */
  exposureBasis: ExposureBasis;
  /** the minimum run hours frozen with the action's criteria (CA2), used as the short-exposure floor */
  minExposureHours: number;
  baseline: ActionBaseline;
}

export interface WatchWindow {
  from: Date;
  to: Date;
}

export interface RecurrenceWatchResult {
  version: string;
  fires: boolean;
  incidents: number;
  /** decimal strings */
  exposureHours: string;
  /** incidents per 1,000 run hours over the observed exposure; null without exposure */
  observedRate: string | null;
  /** incidents per 1,000 run hours over max(observed exposure, minimum exposure): the rate compared */
  guardedRate: string;
  baselineRate: string;
  minExposureHours: number;
  baselineActionId: string;
  exposureBasis: ExposureBasis;
  from: string;
  to: string;
  reason: string;
}

/** Incidents of the frozen baseline window: the approved correction replaces the count (CA3). */
function baselineIncidents(baseline: ActionBaseline): Dec | null {
  if (!baseline.window) return null;
  const corrected =
    baseline.metric === 'recurrences' ? approvedCorrection(baseline) : null;
  return new Dec(corrected ?? baseline.window.incidents);
}

function candidateOf(action: WatchedAction): WatchBaseline | null {
  const { baseline } = action;
  if (action.status === 'cancelled' || action.verdict === null) return null;
  if (!baseline?.window || !baseline.criteria) return null;
  const incidents = baselineIncidents(baseline);
  const rate = incidents
    ? ratePer1000Hours(incidents, new Dec(baseline.window.exposureSeconds))
    : null;
  if (!rate) return null;
  return {
    actionId: action.id,
    rate,
    exposureBasis: baseline.window.exposureBasis ?? 'unit_run_time',
    minExposureHours: baseline.criteria.minExposureHours,
    baseline,
  };
}

/**
 * D-T3: the case's frozen baseline is the pre-action rate of its verified actions (not cancelled, with a
 * CA2 verdict and a CA3 exposure window). With several, the highest rate is used, so the watch only
 * recommends a re-evaluation when the mode now recurs more often than before every verified action. Null
 * when the case has no verified action with run-time exposure (nothing frozen to compare with).
 */
export function watchBaselineOf(
  actions: readonly WatchedAction[],
): WatchBaseline | null {
  let best: WatchBaseline | null = null;
  for (const action of actions) {
    const candidate = candidateOf(action);
    if (candidate && (!best || candidate.rate.gt(best.rate))) best = candidate;
  }
  return best;
}

/** [closedAt, now) while the watch runs; null from 180 days after the closure on (the watch has ended). */
export function watchWindowOf(closedAt: Date, now: Date): WatchWindow | null {
  const end = closedAt.getTime() + RECURRENCE_WATCH_DAYS * DAY_MS;
  if (now.getTime() >= end || now.getTime() <= closedAt.getTime()) return null;
  return { from: closedAt, to: now };
}

const rounded = (value: Dec): string => formatDec(value.toDecimalPlaces(4));

/**
 * D-T3 recurrence watch of a closed case: same-mode unplanned incidents per 1,000 run hours since the
 * closure (on the exposure basis frozen with the baseline) against the case's frozen baseline rate.
 *
 * Short-exposure guard: the rate compared divides by max(observed run hours, the action's frozen minimum
 * exposure — 720 h by default, CA2), the same floor a verification verdict needs. One incident in a few
 * days of run time therefore counts as one incident in the minimum exposure, not as a huge rate; once the
 * exposure passes the minimum, the observed rate itself is compared. It fires only with at least one
 * incident and a guarded rate strictly above the baseline. It only recommends; the case is never reopened.
 */
export function recurrenceWatchOf(input: {
  baseline: WatchBaseline;
  observed: ExposureWindow;
}): RecurrenceWatchResult {
  const { baseline, observed } = input;
  const exposureHours = new Dec(observed.exposureSeconds).div(HOUR);
  const incidents = new Dec(observed.incidents);
  const observedRate = ratePer1000Hours(
    incidents,
    new Dec(observed.exposureSeconds),
  );
  const floorHours = Dec.max(exposureHours, baseline.minExposureHours);
  const guardedRate = incidents.div(floorHours).mul(PER);
  const fires = observed.incidents > 0 && guardedRate.gt(baseline.rate);
  const compared = `${rounded(guardedRate)} per 1,000 run hours since closure (${observed.incidents} incident(s) in ${formatDec(exposureHours.toDecimalPlaces(1))} h, at least ${baseline.minExposureHours} h counted) against the frozen baseline ${rounded(baseline.rate)}`;
  return {
    version: RECURRENCE_WATCH_VERSION,
    fires,
    incidents: observed.incidents,
    exposureHours: formatDec(exposureHours.toDecimalPlaces(2)),
    observedRate: observedRate ? rounded(observedRate) : null,
    guardedRate: rounded(guardedRate),
    baselineRate: rounded(baseline.rate),
    minExposureHours: baseline.minExposureHours,
    baselineActionId: baseline.actionId,
    exposureBasis: baseline.exposureBasis,
    from: observed.from,
    to: observed.to,
    reason: fires
      ? `the mode recurs above its baseline: ${compared}`
      : `no recurrence above the baseline: ${compared}`,
  };
}
