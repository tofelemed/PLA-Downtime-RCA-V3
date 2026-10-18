/**
 * Owner rule for the Marun HDPE training plant (DECISIONS 2026-10-18): no record, name, code, e-mail, note,
 * description or reason it holds may contain the word "demo" in any letter case. Every payload the seeder
 * sends (path and body) passes this guard first; the refusal names where the word is, never the value, so
 * a password is never echoed.
 */
const FORBIDDEN = /demo/i;

/** JSON path of the first string (or key) containing the forbidden word, or null when clean. */
export function forbiddenWordAt(value: unknown, path = '$'): string | null {
  if (typeof value === 'string') return FORBIDDEN.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = forbiddenWordAt(item, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN.test(key)) return `${path}.${key} (key)`;
      const found = forbiddenWordAt(item, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

/** Throws before anything is sent when `value` contains the forbidden word. */
export function assertNoForbiddenWord(where: string, value: unknown): void {
  const at = forbiddenWordAt(value);
  if (!at) return;
  throw new Error(
    `refusing to send ${where}: the word "demo" appears at ${at} (owner rule for HDPE-TRAIN)`,
  );
}
