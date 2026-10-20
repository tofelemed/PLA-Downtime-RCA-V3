import { DAILY_REPORT } from './daily-document';
import { CHRONIC_REPORT, RATE_REPORT } from './losses-documents';
import {
  COMPLIANCE_REPORT,
  PLAN_REPORT,
  RCA_REPORT,
  SCORECARD_REPORT,
} from './management-documents';
import { MONTHLY_REPORT } from './monthly-document';
import { QUALITY_REPORT } from './quality-document';
import { RELIABILITY_REPORT } from './reliability-document';
import { ReportKind } from './report-kind';
import { SHIFT_REPORT } from './shift-document';
import { TRANSITIONS_REPORT } from './transitions-document';

/** Exportable operating reports by the Reports page view key (`?view=`). */
export const REPORT_KINDS: Readonly<
  Record<string, ReportKind<object> | undefined>
> = {
  daily: DAILY_REPORT,
  shift: SHIFT_REPORT,
  monthly: MONTHLY_REPORT,
  quality: QUALITY_REPORT,
  transitions: TRANSITIONS_REPORT,
  reliability: RELIABILITY_REPORT,
  chronic: CHRONIC_REPORT,
  rate: RATE_REPORT,
  compliance: COMPLIANCE_REPORT,
  rca: RCA_REPORT,
  plan: PLAN_REPORT,
  scorecard: SCORECARD_REPORT,
};
