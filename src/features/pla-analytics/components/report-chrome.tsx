import { useMemo, type ReactNode } from 'react';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { ReportChromeContext } from './use-report-chrome';

/**
 * The Reports page look (redesign 24 Oct 2026): shared cards inside drop their captions, "Provisional" chip
 * and calculation details, keep only the notes an operator needs as an ⓘ tooltip, and use the dashboard card;
 * tables are compact with small uppercase headers, empty ones say "No data for these dates", and with
 * Revision = Provisional (`approvedOnly` false) the rows and figures the server marks provisional say so.
 * The PLA analysis pages use the same look (cleanup 24 Oct 2026) with `ownEmpty`: a card or table with its own
 * empty message ("Nothing overdue.") keeps it. The dashboard renders its cards unchanged.
 */
export function ReportChrome({ approvedOnly = true, ownEmpty = false, children }: { approvedOnly?: boolean; ownEmpty?: boolean; children: ReactNode }) {
  const look = useMemo(() => ({ provisional: !approvedOnly, ownEmpty }), [approvedOnly, ownEmpty]);
  return (
    <ReportChromeContext.Provider value>
      <ReportLookContext.Provider value={look}>{children}</ReportLookContext.Provider>
    </ReportChromeContext.Provider>
  );
}
