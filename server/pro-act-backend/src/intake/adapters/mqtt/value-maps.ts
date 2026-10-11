import { PayloadProfile } from './payload-profile';

/**
 * Per-connection value maps (design §4.2 stage 7): `valueMaps.state` turns a raw state token into a
 * DT01 state name, `valueMaps.reason` a raw reason token into a code-library key. Integral numbers
 * are looked up as integer strings (`4.0` → `"4"`), digital states by their name. An unmapped token
 * is a typed `UNMAPPED_VALUE` rejection carrying the raw token (the host quarantines it as
 * `unknown_code`); there is never a silent default (incident CHG-003). A profile may keep an
 * unmapped reason (`reasonUnmapped: keep`) so the event is created uncoded instead of parked.
 */
export type ValueMapKind = 'state' | 'reason';

export type ValueMapResult =
  | { ok: true; value: string; raw: string; mapped: boolean }
  | { ok: false; code: 'UNMAPPED_VALUE'; detail: string; raw: string };

/** The lookup token of a raw value, or null when the value has no token form. */
export function tokenOf(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'boolean') return String(raw);
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? String(raw) : null;
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const name = (raw as Record<string, unknown>).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

/** Looks `raw` up in `map`; the exact token first, then case-insensitively when unambiguous. */
export function mapValue(
  map: Readonly<Record<string, string>>,
  raw: unknown,
  kind: ValueMapKind,
): ValueMapResult {
  const token = tokenOf(raw);
  if (token === null) {
    return unmapped(kind, describe(raw), `${kind} value has no token form`);
  }
  const exact = map[token];
  if (exact !== undefined)
    return { ok: true, value: exact, raw: token, mapped: true };
  const folded = Object.keys(map).filter(
    (key) => key.toLowerCase() === token.toLowerCase(),
  );
  if (folded.length === 1) {
    return { ok: true, value: map[folded[0]], raw: token, mapped: true };
  }
  return unmapped(
    kind,
    token,
    folded.length > 1
      ? `${kind} token "${token}" matches several map keys by case`
      : `${kind} token "${token}" is not in valueMaps.${kind}`,
  );
}

/**
 * The DT01 state name of a raw state token. Without a configured state map the raw token passes
 * through unmapped (the profile declared no vocabulary; nothing is defaulted).
 */
export function mapState(
  profile: PayloadProfile,
  raw: unknown,
): ValueMapResult {
  const map = profile.valueMaps?.state;
  if (!map) return passthrough(raw, 'state');
  return mapValue(map, raw, 'state');
}

/**
 * The code-library key of a raw reason token. Without a reason map the token passes through; with
 * one, an unmapped token is rejected unless the profile says `reasonUnmapped: keep`.
 */
export function mapReason(
  profile: PayloadProfile,
  raw: unknown,
): ValueMapResult {
  const map = profile.valueMaps?.reason;
  if (!map) return passthrough(raw, 'reason');
  const result = mapValue(map, raw, 'reason');
  if (result.ok || profile.reasonUnmapped !== 'keep') return result;
  return { ok: true, value: result.raw, raw: result.raw, mapped: false };
}

function passthrough(raw: unknown, kind: ValueMapKind): ValueMapResult {
  const token = tokenOf(raw);
  if (token === null) {
    return unmapped(kind, describe(raw), `${kind} value has no token form`);
  }
  return { ok: true, value: token, raw: token, mapped: false };
}

function unmapped(
  kind: ValueMapKind,
  raw: string,
  detail: string,
): ValueMapResult {
  return {
    ok: false,
    code: 'UNMAPPED_VALUE',
    detail: `${detail} (${kind})`,
    raw,
  };
}

function describe(raw: unknown): string {
  const text = JSON.stringify(raw) ?? String(raw);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}
