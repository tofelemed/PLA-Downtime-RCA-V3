import type { ReportLook } from '@/features/ux-kit/report-look';

/** The shared report table look of the Setup lists: no provisional figures, every table keeps its own empty message. */
export const SETUP_LOOK: ReportLook = { provisional: false, ownEmpty: true };
