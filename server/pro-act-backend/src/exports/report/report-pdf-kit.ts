import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { latinOnly, PdfFonts } from '../pdf/pdf-fonts';

/** The part of pdfkit's `PDFDocument` the report renderer uses (pdfkit ships no types of its own). */
export interface ReportPdfDoc {
  registerFont(name: string, src: string): ReportPdfDoc;
  addPage(options?: Record<string, unknown>): ReportPdfDoc;
  font(name: string): ReportPdfDoc;
  fontSize(size: number): ReportPdfDoc;
  fillColor(color: string): ReportPdfDoc;
  strokeColor(color: string): ReportPdfDoc;
  lineWidth(width: number): ReportPdfDoc;
  rect(x: number, y: number, w: number, h: number): ReportPdfDoc;
  roundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): ReportPdfDoc;
  fill(color?: string): ReportPdfDoc;
  stroke(): ReportPdfDoc;
  moveTo(x: number, y: number): ReportPdfDoc;
  lineTo(x: number, y: number): ReportPdfDoc;
  image(
    src: Buffer,
    x: number,
    y: number,
    options: Record<string, unknown>,
  ): ReportPdfDoc;
  text(
    text: string,
    x: number,
    y: number,
    options?: Record<string, unknown>,
  ): ReportPdfDoc;
  widthOfString(text: string): number;
  heightOfString(text: string, options?: Record<string, unknown>): number;
  bufferedPageRange(): { start: number; count: number };
  switchToPage(index: number): ReportPdfDoc;
  flushPages(): void;
  on(event: 'data', listener: (chunk: Buffer) => void): ReportPdfDoc;
  on(event: 'end', listener: () => void): ReportPdfDoc;
  end(): void;
  page: { width: number; height: number };
}

type DocConstructor = new (options: Record<string, unknown>) => ReportPdfDoc;

/** The module name in a variable, so the build does not need pdfkit's types (it has none). */
const PDFKIT_MODULE = 'pdfkit';

export async function loadReportPdfKit(): Promise<DocConstructor> {
  const loaded: unknown = await import(PDFKIT_MODULE);
  const candidate =
    typeof loaded === 'function'
      ? loaded
      : (loaded as { default?: unknown } | null)?.default;
  if (typeof candidate !== 'function') {
    throw new Error('pdfkit is not installed or exports no constructor');
  }
  return candidate as DocConstructor;
}

/**
 * The original report colours (navy and red of the Marun logo) and the neutral greys of the tables; used while
 * no branding is stored. `themeOf` replaces navy and red with the configured primary and secondary colours.
 */
export const THEME = {
  navy: '#1F3A8A',
  red: '#D62828',
  ink: '#111827',
  muted: '#6B7280',
  rule: '#D1D5DB',
  zebra: '#F3F4F6',
  tile: '#EEF2FF',
  stamp: '#B91C1C',
} as const;

export type ReportTheme = { readonly [K in keyof typeof THEME]: string };

/** The report colours of an export: its pinned branding's, else the original ones (owner 21 Oct 2026). */
export function themeOf(
  brand: { primaryColor: string; secondaryColor: string } | null | undefined,
): ReportTheme {
  return brand
    ? { ...THEME, navy: brand.primaryColor, red: brand.secondaryColor }
    : THEME;
}

/** The product name printed on an export (its pinned branding's, else the default name). */
export function productNameOf(
  brand: { appName: string } | null | undefined,
): string {
  return brand?.appName ?? 'Traverse Forge';
}

/** A4 landscape in points, and the margins of the page body. */
export const PAGE = {
  width: 842,
  height: 595,
  margin: 36,
  headerBottom: 92,
  footerTop: 565,
} as const;

/**
 * The fallback report logo (owner 2026-10-20: `marun.png` at the top; since 21 Oct 2026 the configured
 * branding logo comes first, `brandLogoOf`): `REPORT_LOGO_PATH`, else `assets/marun.png` of the backend; none
 * when the file is missing (the header then shows the plant name alone).
 */
export function reportLogo(
  env: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  const path =
    env.REPORT_LOGO_PATH?.trim() || join(process.cwd(), 'assets', 'marun.png');
  return existsSync(path) ? readFileSync(path) : null;
}

/** Text the chosen fonts can draw (built-in Helvetica: Latin only — a minus sign becomes a hyphen, anything else `?`). */
export const drawable = (fonts: PdfFonts) => (text: string) =>
  fonts.unicode ? text : latinOnly(text.replace(/−/g, '-'));

/** The largest font size from `max` down to `min` at which `text` fits `width` (the size is left set). */
export function shrinkToFit(
  doc: ReportPdfDoc,
  text: string,
  width: number,
  sizes: { max: number; min: number },
): void {
  let size = sizes.max;
  doc.fontSize(size);
  while (size > sizes.min && doc.widthOfString(text) > width) {
    size -= 0.5;
    doc.fontSize(size);
  }
}

/** Cuts `text` with an ellipsis so it fits `width` at the current font and size. */
export function fitText(
  doc: ReportPdfDoc,
  text: string,
  width: number,
): string {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width)
    cut = cut.slice(0, -1);
  return `${cut}…`;
}
