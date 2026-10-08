import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const THROTTLE_DEFAULT_TTL_MS = 60_000;
export const THROTTLE_DEFAULT_LIMIT = 300;

/** Global rate limit: `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` window, per user (or per IP when anonymous). */
export function throttlerOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: positiveInt(env.THROTTLE_TTL_MS, THROTTLE_DEFAULT_TTL_MS),
        limit: positiveInt(env.THROTTLE_LIMIT, THROTTLE_DEFAULT_LIMIT),
      },
    ],
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
