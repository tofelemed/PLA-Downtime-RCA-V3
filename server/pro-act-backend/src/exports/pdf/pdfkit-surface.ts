import { latinOnly, PdfFonts } from './pdf-fonts';
import { PdfInfo, PdfSink, PdfSurface, PdfTextStyle } from './pdf-surface';

/** The part of pdfkit's `PDFDocument` this adapter uses (pdfkit ships no types of its own). */
interface PdfKitDocument {
  registerFont(name: string, src: string): PdfKitDocument;
  addPage(options: Record<string, unknown>): PdfKitDocument;
  font(name: string): PdfKitDocument;
  fontSize(size: number): PdfKitDocument;
  fillColor(color: string): PdfKitDocument;
  strokeColor(color: string): PdfKitDocument;
  lineWidth(width: number): PdfKitDocument;
  text(
    text: string,
    x: number,
    y: number,
    options: Record<string, unknown>,
  ): PdfKitDocument;
  moveTo(x: number, y: number): PdfKitDocument;
  lineTo(x: number, y: number): PdfKitDocument;
  stroke(): PdfKitDocument;
  on(event: 'data', listener: (chunk: Buffer) => void): PdfKitDocument;
  on(event: 'end', listener: () => void): PdfKitDocument;
  end(): void;
}

type PdfKitConstructor = new (
  options: Record<string, unknown>,
) => PdfKitDocument;

/** The module name in a variable, so the build does not need pdfkit's types (it has none). */
const PDFKIT_MODULE = 'pdfkit';

async function loadPdfKit(): Promise<PdfKitConstructor> {
  const loaded: unknown = await import(PDFKIT_MODULE);
  const candidate =
    typeof loaded === 'function'
      ? loaded
      : (loaded as { default?: unknown } | null)?.default;
  if (typeof candidate !== 'function') {
    throw new Error('pdfkit is not installed or exports no constructor');
  }
  return candidate as PdfKitConstructor;
}

/**
 * A text box holds exactly one line (QA re-test N4: a box of two lines let a long cell wrap over the next
 * row); the layout wraps cells itself, and anything still too long is cut with an ellipsis.
 */
const oneLineBox = (size: number) => Math.ceil(size * 1.5);

class PdfKitSurface implements PdfSurface {
  private pending: Promise<void> = Promise.resolve();
  private failure: Error | null = null;
  private readonly ended: Promise<void>;

  constructor(
    private readonly doc: PdfKitDocument,
    private readonly fonts: PdfFonts,
    sink: PdfSink,
  ) {
    doc.on('data', (chunk) => {
      this.pending = this.pending
        .then(() => sink.write(chunk))
        .catch((error: unknown) => {
          this.failure =
            error instanceof Error ? error : new Error(String(error));
        });
    });
    this.ended = new Promise((resolve) => doc.on('end', resolve));
    if (fonts.unicode) {
      doc.registerFont('regular', fonts.regular);
      doc.registerFont('bold', fonts.bold);
    }
  }

  addPage(): void {
    this.doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
  }

  text(text: string, x: number, y: number, style: PdfTextStyle): void {
    const registered = style.bold ? 'bold' : 'regular';
    const builtIn = style.bold ? this.fonts.bold : this.fonts.regular;
    this.doc
      .font(this.fonts.unicode ? registered : builtIn)
      .fontSize(style.size)
      .fillColor(style.color)
      .text(this.fonts.unicode ? text : latinOnly(text), x, y, {
        width: style.width,
        height: oneLineBox(style.size),
        align: style.align,
        lineBreak: false,
        ellipsis: true,
      });
  }

  rule(x1: number, x2: number, y: number, color: string): void {
    this.doc
      .strokeColor(color)
      .lineWidth(0.5)
      .moveTo(x1, y)
      .lineTo(x2, y)
      .stroke();
  }

  async end(): Promise<void> {
    this.doc.end();
    await this.ended;
    await this.pending;
    if (this.failure !== null) throw this.failure;
  }
}

/**
 * The pdfkit surface (pure JavaScript, no headless browser). The document info carries the export's
 * request time as its creation date, which pdfkit also derives the file id from, so the same job renders
 * the same bytes.
 */
export async function createPdfKitSurface(
  sink: PdfSink,
  info: PdfInfo,
  fonts: PdfFonts,
): Promise<PdfSurface> {
  const PdfDocument = await loadPdfKit();
  const doc = new PdfDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Title: info.title,
      Subject: info.subject,
      Producer: 'Traverse Forge',
      Creator: 'Traverse Forge',
      CreationDate: info.createdAt,
      ModDate: info.createdAt,
    },
  });
  return new PdfKitSurface(doc, fonts, sink);
}
