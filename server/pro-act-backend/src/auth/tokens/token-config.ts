import { createHmac } from 'crypto';
import { JWT_SECRET } from '../jwt.constants';

/** `typ` claim of the two token kinds (plan 3.11): a refresh token is never accepted as an access token. */
export type TokenType = 'access' | 'refresh';

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_REUSE_GRACE_SECONDS = 30;
const UNIT_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Parses `900`, `900s`, `15m`, `24h`, `7d` into seconds; anything else (or ≤ 0) gives the fallback.
 */
export function parseDurationSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  const match = /^\s*(\d+)\s*([smhd]?)\s*$/i.exec(raw ?? '');
  if (!match) return fallback;
  const seconds =
    Number(match[1]) * UNIT_SECONDS[(match[2] || 's').toLowerCase()];
  return seconds > 0 ? seconds : fallback;
}

export interface TokenConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  /** a refresh token presented again within this window (parallel tabs) forks instead of revoking */
  reuseGraceSeconds: number;
  refreshSecret: string;
  /** true when JWT_REFRESH_SECRET is missing and the refresh key is derived from JWT_SECRET */
  refreshSecretDerived: boolean;
}

/**
 * Token settings from the environment (D15: local JWT, short-lived access tokens, rotated refresh tokens,
 * separate signing keys). `JWT_ACCESS_TTL` (default 15 min), `JWT_REFRESH_EXPIRATION` (default 7 d),
 * `JWT_REFRESH_SECRET` (default: an HMAC of JWT_SECRET, so the two keys always differ).
 */
export function loadTokenConfig(
  env: NodeJS.ProcessEnv = process.env,
): TokenConfig {
  const configured = (env.JWT_REFRESH_SECRET ?? '').trim();
  return {
    accessTtlSeconds: parseDurationSeconds(
      env.JWT_ACCESS_TTL,
      DEFAULT_ACCESS_TTL_SECONDS,
    ),
    refreshTtlSeconds: parseDurationSeconds(
      env.JWT_REFRESH_EXPIRATION,
      DEFAULT_REFRESH_TTL_SECONDS,
    ),
    reuseGraceSeconds: parseDurationSeconds(
      env.JWT_REFRESH_REUSE_GRACE,
      DEFAULT_REUSE_GRACE_SECONDS,
    ),
    refreshSecret:
      configured && configured !== JWT_SECRET
        ? configured
        : createHmac('sha256', JWT_SECRET)
            .update('pro-act refresh tokens')
            .digest('hex'),
    refreshSecretDerived: !configured || configured === JWT_SECRET,
  };
}

/** Whether a verified payload is an access token (tokens issued before 3.11 carry no `typ`). */
export function isAccessToken(
  payload: { typ?: unknown } | null | undefined,
): boolean {
  return payload?.typ === 'access';
}
