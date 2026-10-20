import { EnginePolicy, LossEvent } from './accounting.types';

/** The policy fields the micro-stop rule reads (the engine policy, or an `oee_policy` read on its own). */
export type MicroStopPolicy = Pick<
  EnginePolicy,
  'microStopSeconds' | 'microStopSecondsByAssetClass' | 'tripReasonCodes'
>;

/** SME D8: severities of a functional failure (needs maintenance, never operator-cleared). */
const FUNCTIONAL_FAILURE = new Set(['critical', 'degraded']);

const keyOf = (value: string) => value.trim().toLowerCase();

/** Asset class (asset type) → threshold, keys compared without case; absent = none. */
function classThresholds(policy: MicroStopPolicy): Map<string, number> {
  return new Map(
    Object.entries(policy.microStopSecondsByAssetClass ?? {}).map(
      ([assetClass, seconds]) => [keyOf(assetClass), seconds],
    ),
  );
}

/**
 * SME D6: the micro-stop threshold of one stop occurrence (seconds; an occurrence shorter than it stays in
 * running time and reduces performance). A process trip is always an availability event, never a
 * micro-stop: an occurrence coded with a trip reason (`tripReasonCodes`) or carrying a functional failure
 * (severity critical / degraded) gets 0. Otherwise the threshold of the asset class of its first event
 * with a configured class, else the unit's `microStopSeconds`.
 */
export function microStopThresholdOf(
  events: readonly LossEvent[],
  policy: MicroStopPolicy,
): number {
  const trips = new Set((policy.tripReasonCodes ?? []).map(keyOf));
  const isTrip = (e: LossEvent) =>
    (e.reasonCode != null && trips.has(keyOf(e.reasonCode))) ||
    (e.failureSeverity != null && FUNCTIONAL_FAILURE.has(e.failureSeverity));
  if (events.some(isTrip)) return 0;
  const byClass = classThresholds(policy);
  if (byClass.size === 0) return policy.microStopSeconds;
  const first = [...events]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((e) => e.assetClass && byClass.has(keyOf(e.assetClass)));
  return first?.assetClass
    ? (byClass.get(keyOf(first.assetClass)) as number)
    : policy.microStopSeconds;
}

/** Threshold per occurrence id of the given events (one entry per occurrence). */
export function occurrenceThresholds(
  events: readonly LossEvent[],
  policy: MicroStopPolicy,
): Map<string, number> {
  const groups = new Map<string, LossEvent[]>();
  for (const event of events) {
    groups.set(event.occurrenceId, [
      ...(groups.get(event.occurrenceId) ?? []),
      event,
    ]);
  }
  return new Map(
    [...groups].map(([id, group]) => [id, microStopThresholdOf(group, policy)]),
  );
}
