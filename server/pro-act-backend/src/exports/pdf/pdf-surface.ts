/** Text style a surface draws with. */
export interface PdfTextStyle {
  size: number;
  bold: boolean;
  /** hex colour `#rrggbb` */
  color: string;
  align: 'left' | 'right';
  /** box width in points; text longer than it is cut with an ellipsis */
  width: number;
}

/**
 * What the layout needs of a PDF library (the renderer is isolated behind it, so the layout is tested
 * with a fake and the library can be replaced). Coordinates are points from the top-left of the page.
 */
export interface PdfSurface {
  addPage(): void;
  text(text: string, x: number, y: number, style: PdfTextStyle): void;
  rule(x1: number, x2: number, y: number, color: string): void;
  /** finishes the document; resolves once every byte was handed to the sink */
  end(): Promise<void>;
}

/** Where a surface writes its bytes (the export's hashing writer). */
export interface PdfSink {
  write(chunk: Buffer): Promise<void>;
}

/** Document info; `createdAt` is the request time, so re-rendering a job reproduces its bytes. */
export interface PdfInfo {
  title: string;
  subject: string;
  createdAt: Date;
}

/** Builds a surface writing to `sink` (A4 landscape). */
export type PdfSurfaceFactory = (
  sink: PdfSink,
  info: PdfInfo,
) => Promise<PdfSurface>;
