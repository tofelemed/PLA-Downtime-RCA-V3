/**
 * A report export's content (`export_jobs.report_content`, owner 2026-10-20): what an operating report
 * showed when the export was requested, independent of PDF or Excel. Values stay raw — decimal strings,
 * ISO instants, plant dates — and carry a type, so the PDF prints them on the plant's calendar and digits
 * and the workbook stores real numbers, percentages and dates. Re-rendering a job reproduces its file.
 */

/** How a cell is read and printed. */
export type ReportValueType =
  /** plain text */
  | 'text'
  /** a decimal string, `places` decimals */
  | 'number'
  /** a 0..1 ratio printed as a percentage */
  | 'percent'
  /** seconds printed as hours and minutes */
  | 'duration'
  /** an amount in the column's (or the cell's) currency */
  | 'money'
  /** a plant date `YYYY-MM-DD` */
  | 'date'
  /** a plant month `YYYY-MM` */
  | 'month'
  /** an ISO instant printed on the plant clock */
  | 'datetime';

export interface ReportColumn {
  label: string;
  type: ReportValueType;
  /** decimals of a number (default 1) */
  places?: number;
  /** unit printed after the header (`t`, `USD`) */
  unit?: string;
  /** relative width in the PDF (default 1) */
  width?: number;
}

/** One cell: its raw value, or null (printed `—`, an empty cell in Excel). */
export type ReportCell = string | number | null;

export interface ReportTable {
  kind: 'table';
  title: string;
  /** a sentence under the title (definitions, cut-offs) */
  note?: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  /** the Excel sheet name (≤ 31 characters); default: the title */
  sheet?: string;
}

export interface ReportKpi {
  label: string;
  value: ReportCell;
  type: ReportValueType;
  places?: number;
  unit?: string;
  /** a short caption under the value */
  caption?: string;
}

export interface ReportKpis {
  kind: 'kpis';
  title: string;
  items: ReportKpi[];
}

export interface ReportFacts {
  kind: 'facts';
  title: string;
  rows: Array<[string, string]>;
}

export interface ReportText {
  kind: 'text';
  title: string;
  paragraphs: string[];
}

export type ReportSection = ReportTable | ReportKpis | ReportFacts | ReportText;

export interface ReportDocument {
  /** report kind (`daily`, `shift`, …) */
  kind: string;
  title: string;
  /** what the report answers, one line under the title */
  subtitle: string;
  /** the window as the report read it (UTC), and the units by name */
  from: string;
  to: string;
  units: string[];
  /** some figures come from draft (not approved) revisions: every page is stamped */
  provisional: boolean;
  /** periods of the window without an approved revision (said on the cover) */
  unapprovedPeriods: number;
  /** the document holds money (only for requesters who may see money) */
  money: boolean;
  sections: ReportSection[];
}
