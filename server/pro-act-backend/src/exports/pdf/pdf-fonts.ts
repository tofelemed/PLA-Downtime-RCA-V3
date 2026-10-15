/** Fonts a PDF is drawn with. */
export interface PdfFonts {
  regular: string;
  bold: string;
  /** true for an embedded TrueType font (Persian glyphs); false for the built-in Helvetica (Latin only) */
  unicode: boolean;
}

/**
 * `EXPORT_PDF_FONT` (and optionally `EXPORT_PDF_FONT_BOLD`) name TrueType files with Persian glyphs
 * (e.g. Vazirmatn, SIL OFL) for plants with Persian names or digits; without them the built-in Helvetica
 * is used, Persian digits fall back to Latin and characters it cannot draw are printed as `?`.
 */
export function resolvePdfFonts(
  env: NodeJS.ProcessEnv = process.env,
): PdfFonts {
  const regular = env.EXPORT_PDF_FONT?.trim();
  if (!regular) {
    return { regular: 'Helvetica', bold: 'Helvetica-Bold', unicode: false };
  }
  return {
    regular,
    bold: env.EXPORT_PDF_FONT_BOLD?.trim() || regular,
    unicode: true,
  };
}

/** Typographic marks the built-in (WinAnsi) fonts draw beyond Latin-1 (dashes, quotes, bullet, ellipsis). */
const WIN_ANSI_MARKS = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026,
]);

function drawable(code: number): boolean {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_MARKS.has(code)
  );
}

/** Text a Latin-only font can draw (anything else becomes a question mark). */
export function latinOnly(text: string): string {
  return Array.from(text)
    .map((char) => (drawable(char.codePointAt(0) ?? 0) ? char : '?'))
    .join('');
}
