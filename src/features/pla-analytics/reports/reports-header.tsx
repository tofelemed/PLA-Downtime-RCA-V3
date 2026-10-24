import { PageHeader } from '@/features/ux-kit/page-layout';

/**
 * Reports header: the h1 only (redesign 24 Oct 2026 — no description, scope line, revision badge or
 * snapshot status; the top bar shows the dates, units and revision).
 */
export function ReportsHeader() {
  return <PageHeader title="Reports" />;
}
