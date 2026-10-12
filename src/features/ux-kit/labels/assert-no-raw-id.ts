import { createLogger } from '@/lib/logger';

/** Development guard against internal ids on screen (docs/UI_UX_AUDIT.md §6, Appendix C.2). */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
/** A standalone hex run of 8+ characters mixing digits and letters, e.g. the slice `d9800d1c`. */
const HEX_SLICE = /(?:^|[^0-9a-z])([0-9a-f]{8,})(?![0-9a-z])/gi;

const logger = createLogger('ux-kit');
const warned = new Set<string>();

function isMixedHex(token: string): boolean {
  return /\d/.test(token) && /[a-f]/i.test(token);
}

/** True when `value` contains a UUID (also `entity_<uuid>`) or an 8+ character hex id slice. */
export function looksLikeRawId(value: string): boolean {
  if (UUID.test(value)) return true;
  for (const match of value.matchAll(HEX_SLICE)) {
    if (isMixedHex(match[1])) return true;
  }
  return false;
}

/**
 * Development only: warns once per (where, value) when a rendered string or number looks like an internal
 * id ("[no-raw-id] <where> renders an internal id"). No-op in production builds.
 */
export function assertNoRawId(value: unknown, where: string): void {
  if (!import.meta.env.DEV) return;
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const text = String(value);
  if (!looksLikeRawId(text)) return;
  const key = `${where}\u0000${text}`;
  if (warned.has(key)) return;
  warned.add(key);
  logger.warn(`[no-raw-id] ${where} renders an internal id`, text);
}

/** Test helper: forget which values were already reported. */
export function resetNoRawIdWarnings(): void {
  warned.clear();
}
