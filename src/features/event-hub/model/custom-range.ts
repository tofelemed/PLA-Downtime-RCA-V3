export interface InstantBounds {
  from: string | null;
  to: string | null;
}

export const ORDER_MESSAGE = 'The end must be after the start';

/** Why a custom range cannot be applied yet; null when it can (QA audit L3: judged on what is typed now). */
export function customRangeProblem(range: InstantBounds): string | null {
  if (!range.from || !range.to) return 'Enter both the start and the end.';
  return Date.parse(range.from) < Date.parse(range.to) ? null : ORDER_MESSAGE;
}
