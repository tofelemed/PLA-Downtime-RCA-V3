const BOM = String.fromCharCode(0xfeff);

/**
 * QA audit L5: the server sends the CSV with a UTF-8 byte order mark, but reading the response as text drops
 * it; the saved file needs it back, or spreadsheet tools garble non-ASCII text (Persian names, "–").
 */
export function withByteOrderMark(text: string): string {
  return text.startsWith(BOM) ? text : `${BOM}${text}`;
}
