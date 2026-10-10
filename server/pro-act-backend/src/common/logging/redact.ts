/**
 * Log redaction (plan 3.11 step 3, NFR03 "no credentials in logs"): masks bearer tokens, JWTs,
 * credentials in connection strings and secret-looking query / JSON fields before a line is logged.
 */
const RULES: ReadonlyArray<[RegExp, string]> = [
  [/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]'],
  [
    /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
    '[REDACTED_JWT]',
  ],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s/]+@/gi, '$1[REDACTED]@'],
  [
    /((?:password|passwd|secret|token|api[_-]?key|refresh[_-]?token|access[_-]?token|authorization)["']?\s*[:=]\s*["']?)[^"'&\s,}]+/gi,
    '$1[REDACTED]',
  ],
  [/(enc:v[12]:)[A-Za-z0-9+/=:_-]+/g, '$1[REDACTED]'],
];

export function redactSecrets(text: string): string {
  return RULES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}
