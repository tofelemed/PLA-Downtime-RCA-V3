import { DAILY_REPORT } from './daily-document';
import { ReportKind } from './report-kind';

/** Exportable operating reports by the Reports page view key (`?view=`). */
export const REPORT_KINDS: Readonly<
  Record<string, ReportKind<object> | undefined>
> = {
  daily: DAILY_REPORT,
};
