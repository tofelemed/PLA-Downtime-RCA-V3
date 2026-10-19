import type { RcaActionView } from '@/api/v2/types/rca';

/** The current policy's version and run-hour minimum (from `GET /rca-policies/current`). */
export interface CurrentRunHourRule {
  version: number;
  effectiveness: { minExposureHours: number };
}

interface Frozen {
  version: number | undefined;
  hours: number;
}

function frozenOf(action: RcaActionView): Frozen | null {
  const criteria = action.baseline?.criteria;
  if (!criteria) return null;
  return { version: action.baselinePolicyVersion ?? criteria.policyVersion, hours: criteria.minExposureHours };
}

const unique = <T,>(values: readonly T[]) => [...new Set(values)];

/**
 * QA M7: text written on the case (residual risk) may quote the run-hour minimum its actions were frozen with
 * ("720 run-hour policy minimum"); when the current RCA policy asks for another minimum, say so — the frozen
 * thresholds stay, the current one applies to new baselines. Null when every frozen minimum matches.
 */
export function runHourPolicyNote(
  actions: readonly RcaActionView[],
  current: CurrentRunHourRule | undefined,
  number: (value: number) => string = String,
): string | null {
  if (!current) return null;
  const now = current.effectiveness.minExposureHours;
  const differing = actions.flatMap((action) => {
    const frozen = frozenOf(action);
    return frozen && frozen.hours !== now ? [frozen] : [];
  });
  if (differing.length === 0) return null;
  const versions = unique(differing.map((f) => f.version).filter((v): v is number => v !== undefined)).sort((a, b) => a - b);
  const hours = unique(differing.map((f) => f.hours)).sort((a, b) => a - b).map(number).join(' or ');
  const source = versions.length > 0 ? `RCA policy ${versions.map((v) => `v${v}`).join(', ')}` : 'the RCA policy in force when their verification was planned';
  return (
    `The actions' thresholds were frozen from ${source} (at least ${hours} run hours after an action). ` +
    `The current policy v${current.version} asks for at least ${number(now)} run hours; it applies to new baselines.`
  );
}
