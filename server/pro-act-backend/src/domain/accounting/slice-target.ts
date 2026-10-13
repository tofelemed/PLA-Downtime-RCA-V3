import { Dec, formatDec, ZERO } from '../actuals/decimal';

interface Window {
  start: Date;
  end: Date;
}

function overlapMs(a: Window, b: Window): number {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  return Math.max(0, end - start);
}

/**
 * LA-07: the part of a plan period's target a slice carries — target × overlap / plan-period length.
 * A slice equal to its plan period keeps the whole target; one clipped by the production period
 * (e.g. after a calendar regeneration moved the period boundaries) carries only its time share, so
 * the target is never counted twice.
 */
export function sliceTarget(
  target: string,
  planPeriod: Window,
  slice: Window,
): string {
  const length = planPeriod.end.getTime() - planPeriod.start.getTime();
  if (length <= 0) return formatDec(ZERO);
  const share = overlapMs(planPeriod, slice);
  if (share === length) return target;
  return formatDec(new Dec(target).times(share).div(length));
}
