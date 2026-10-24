import type { ReportLook } from '@/features/ux-kit/report-look';

/**
 * The report look of the Asset reliability reports (cleanup 24 Oct 2026): compact tables, small uppercase
 * headers; the figures are approved only (no Provisional marker) and an empty table or state keeps its own
 * message ("No approved loss or stops in this window.") instead of the generic "No data for these dates".
 */
export const RELIABILITY_LOOK: ReportLook = { provisional: false, ownEmpty: true };
