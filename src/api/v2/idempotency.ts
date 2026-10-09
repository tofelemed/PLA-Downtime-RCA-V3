/**
 * Idempotency keys (API02): one key per command attempt — a user action — reused by every automatic
 * retry of that attempt, so the server replays the stored response instead of acting twice.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A command input with the key of its attempt (TanStack retries call the mutation fn with the same value). */
export interface CommandAttempt<TInput> {
  input: TInput;
  idempotencyKey: string;
}

export function commandAttempt<TInput>(input: TInput): CommandAttempt<TInput> {
  return { input, idempotencyKey: newIdempotencyKey() };
}
