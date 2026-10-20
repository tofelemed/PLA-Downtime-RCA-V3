export const CLOSE_SECTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'periods', label: 'Periods' },
  { value: 'days', label: 'Days' },
  { value: 'proposals', label: 'Proposals' },
  { value: 'exceptions', label: 'Exceptions' },
  { value: 'history', label: 'History' },
] as const;

export type CloseSection = typeof CLOSE_SECTIONS[number]['value'];

export function closeSection(value: string | null): CloseSection {
  return CLOSE_SECTIONS.find((section) => section.value === value)?.value ?? 'overview';
}

/** Change one query key without discarding month, section or other caller context. */
export function closeSearch(params: URLSearchParams, key: 'month' | 'section', value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(key, value);
  return next;
}
