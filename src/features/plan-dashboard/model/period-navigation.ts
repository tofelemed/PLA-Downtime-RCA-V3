import type { LedgerKind, RevisionSelector } from '@/api/v2/types/period-overview';

export const PERIOD_SECTIONS = [
  { path: '', label: 'Reconciliation' },
  { path: 'actuals', label: 'Actuals & quality' },
  { path: 'review', label: 'Review & close' },
  { path: 'value', label: 'Value' },
  { path: 'history', label: 'History & exports' },
] as const;

export type PeriodSection = (typeof PERIOD_SECTIONS)[number]['path'];

export function isPeriodSection(value: string): value is PeriodSection {
  return PERIOD_SECTIONS.some((section) => section.path === value);
}

export function periodSelection(search: URLSearchParams): { view: RevisionSelector; ledger: LedgerKind } {
  return { view: search.get('view') === 'approved' ? 'approved' : 'current', ledger: search.get('ledger') === 'capacity' ? 'capacity' : 'plan' };
}

/** Preserve unrelated context, including deep-link filters, when changing one selection. */
export function withPeriodSelection(search: URLSearchParams, key: 'view' | 'ledger', value: string): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set(key, value);
  return next;
}

export function periodPath(planId: string, periodId: string, section: PeriodSection = ''): string {
  return `/plans/${planId}/periods/${periodId}${section ? `/${section}` : ''}`;
}
