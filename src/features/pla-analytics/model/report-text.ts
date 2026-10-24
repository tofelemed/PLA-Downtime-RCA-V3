/**
 * A title or note as the Reports page says it: without "Operational" before OEE, "(ISO 22400)" and
 * "by plant date" (owner, 24 Oct 2026). A title then starts with a capital; a note (tooltip, ⓘ text) keeps
 * its case. The server's labels stay unchanged elsewhere.
 */
export function reportText(text: string, kind: 'title' | 'note' = 'title'): string {
  const plain = text
    .replace(/\bOperational\s+(?=OEE\b)/g, '')
    .replace(/\s*\(ISO 22400\)/g, '')
    .replace(/\s+by plant date\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return kind === 'title' ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain;
}
