import type { ReactNode } from 'react';
import { ReportChromeContext } from './use-report-chrome';

/**
 * The Reports page look (redesign 24 Oct 2026, text cleanup): shared cards inside drop their captions,
 * "Provisional" chip and calculation details, and keep only the notes an operator needs as an ⓘ tooltip.
 * Other pages (PLA analytics, valuation, dashboard) render the same cards unchanged.
 */
export function ReportChrome({ children }: { children: ReactNode }) {
  return <ReportChromeContext.Provider value>{children}</ReportChromeContext.Provider>;
}
