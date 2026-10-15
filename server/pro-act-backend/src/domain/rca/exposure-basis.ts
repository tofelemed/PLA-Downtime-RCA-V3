import { StandbyExposure } from '../kpi/standby-mtbf';
import {
  BoundedInterval,
  clip,
  union,
  unionSeconds,
} from '../time/interval-algebra';

/**
 * CA2 / CA4 run-time exposure basis of an effectiveness window. A duty asset is exposed while its unit
 * runs (the window minus every unit downtime). A standby asset is exposed only while it runs itself (SME
 * D9: standby time never adds exposure), and it typically runs exactly while the duty unit is down — so
 * for a case about standby assets the exposure is their own running time from the standby log.
 */
export type ExposureBasis = 'unit_run_time' | 'standby_running_time';

/**
 * `standby_running_time` when the case has assets and every one is registered as standby in the window;
 * otherwise (no asset, or duty and standby assets mixed) the unit run time.
 */
export function exposureBasisOf(
  caseAssetIds: readonly string[],
  standbyAssetIds: readonly string[],
): ExposureBasis {
  if (caseAssetIds.length === 0) return 'unit_run_time';
  const standby = new Set(standbyAssetIds);
  return caseAssetIds.every((id) => standby.has(id))
    ? 'standby_running_time'
    : 'unit_run_time';
}

/**
 * Seconds in the window during which at least one of the standby assets ran (their runs merged, so two
 * spares running together are not counted twice); an open run is measured to `asOf`.
 */
export function standbyRunningSeconds(
  standbys: readonly StandbyExposure[],
  window: BoundedInterval,
  asOf: Date,
): number {
  const parts = standbys.flatMap((standby) =>
    standby.runs.flatMap((run) => {
      const part = clip({ start: run.start, end: run.end ?? asOf }, window);
      return part ? [part] : [];
    }),
  );
  return unionSeconds(union(parts));
}
