import { EntityManager } from 'typeorm';
import { RcaPolicy } from '../domain/rca/rca-policy';
import { ActionBaseline, BaselineMetric } from '../domain/rca/rca-verification';
import {
  caseModeFootprint,
  EXPOSURE_QUERY_VERSION,
  exposureWindow,
} from './effectiveness-exposure';
import { invalidBody } from './rca-scope';

const DAY_MS = 86_400_000;

export interface BaselineRequest {
  metric: BaselineMetric;
  /** lookback days before the verification window; the policy's (CA3: 90) when omitted */
  windowDays?: number;
}

/**
 * CA3 baseline of an action, computed by the server and frozen: same-mode incidents of the case's assets
 * over the lookback before the verification window, with the run-time exposure of the window, the query
 * version and the CA2 acceptance criteria of the policy in force. A person never types the value; a
 * correction goes through `proposeCorrection` and an independent decision.
 */
export async function computeBaseline(
  manager: EntityManager,
  input: {
    tenantId: string;
    rcaId: string;
    request: BaselineRequest;
    windowStart: Date | null;
    policy: RcaPolicy;
    consequenceClass: string | null;
    now: Date;
  },
): Promise<ActionBaseline> {
  if (!input.windowStart) {
    throw invalidBody(
      'BASELINE_NEEDS_WINDOW',
      'baseline',
      'a baseline needs the verification window start',
    );
  }
  const rules = input.policy.effectiveness;
  const windowDays = input.request.windowDays ?? rules.baselineLookbackDays;
  const footprint = await caseModeFootprint(manager, {
    tenantId: input.tenantId,
    rcaId: input.rcaId,
    match: input.policy.repeatMatch,
  });
  const window = await exposureWindow(manager, {
    tenantId: input.tenantId,
    footprint,
    from: new Date(input.windowStart.getTime() - windowDays * DAY_MS),
    to: input.windowStart,
  });
  return {
    metric: input.request.metric,
    windowDays,
    value:
      input.request.metric === 'recurrences'
        ? String(window.incidents)
        : window.downtimeSeconds,
    declared: false,
    window,
    match: footprint.match,
    modeKeys: footprint.modeKeys,
    queryVersion: EXPOSURE_QUERY_VERSION,
    computedAt: input.now.toISOString(),
    criteria: {
      requiredReduction: rules.requiredReduction,
      minExposureHours: rules.minExposureHours,
      zeroRepeat: (rules.zeroRepeatClasses as readonly string[]).includes(
        input.consequenceClass ?? '',
      ),
    },
    correction: null,
  };
}
