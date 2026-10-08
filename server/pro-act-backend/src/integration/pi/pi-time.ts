/**
 * PI open event frames carry a far-future end time instead of none (PI03; the documented default is
 * `9999-12-31T23:59:59Z`, D02 item 4 still to be confirmed on the plant installation). Anything at or
 * after 9999-01-01 is treated as "still open"; the raw value stays in the retained payload.
 */
export const PI_OPEN_SENTINEL_FROM = Date.UTC(9999, 0, 1);

/** True when a PI end time means "the frame is still open" (absent, unparsable or the sentinel). */
export function isOpenEndTime(raw: string | null | undefined): boolean {
  return piEndTime(raw) === null;
}

/** The end of a PI frame, or null while it is open; never the sentinel itself (T02 end to end). */
export function piEndTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  const millis = parsed.getTime();
  if (Number.isNaN(millis) || millis >= PI_OPEN_SENTINEL_FROM) return null;
  return parsed;
}

/** ISO form of `piEndTime`. */
export function piEndTimeIso(raw: string | null | undefined): string | null {
  return piEndTime(raw)?.toISOString() ?? null;
}
