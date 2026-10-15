import {
  CalendarSystem,
  DigitSystem,
} from '../../tenant/tenant-display-settings';

/** Reporting currencies a PDF can show (D08; owner: USD by default, IRR on request). */
export const PDF_CURRENCIES = ['USD', 'IRR'] as const;
export type PdfCurrency = (typeof PDF_CURRENCIES)[number];
export const DEFAULT_PDF_CURRENCY: PdfCurrency = 'USD';

/**
 * How a PDF export is presented, pinned on the job when it is requested (`export_jobs.presentation`), so
 * re-rendering reproduces the bytes even after the plant changes its settings.
 */
export interface ExportPresentation {
  plantName: string;
  /** IANA zone of the plant; null = UTC (named on the page) */
  timezone: string | null;
  calendar: CalendarSystem;
  digits: DigitSystem;
  currency: PdfCurrency;
}

/** One column of a table: its label, share of the table width and alignment. */
export interface PdfColumn {
  label: string;
  width: number;
  align: 'left' | 'right';
}

export type PdfBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'facts'; rows: ReadonlyArray<readonly [string, string]> }
  | { kind: 'label'; text: string; tone: 'approved' | 'provisional' | 'muted' }
  | { kind: 'table'; columns: readonly PdfColumn[]; rows: string[][] };

/** One printed page: the running header, the blocks in order and the page number. */
export interface PdfPage {
  number: number;
  header: {
    title: string;
    subtitle: string;
    status: string;
    tone: 'approved' | 'provisional';
  };
  blocks: PdfBlock[];
  footer: string;
}

/** The whole document, independent of the PDF library that draws it. */
export interface PdfDocumentModel {
  info: { title: string; subject: string; createdAt: Date };
  pages: PdfPage[];
}
