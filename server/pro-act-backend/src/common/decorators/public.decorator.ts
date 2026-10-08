import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const PUBLIC_IF_ENV_KEY = 'publicIfEnv';

/** Route needs no authentication (login, health, ...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Route is public only while the named environment variable is `'true'`
 * (e.g. `AUTH_ALLOW_PUBLIC_REGISTRATION` for local development); otherwise the
 * global guard chain applies as usual.
 */
export const PublicIf = (envVar: string) => SetMetadata(PUBLIC_IF_ENV_KEY, envVar);

/** Shared by every global guard so they agree on what "public" means. */
export function isPublicRoute(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  const targets = [context.getHandler(), context.getClass()];
  if (reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
    return true;
  }
  const envVar = reflector.getAllAndOverride<string>(PUBLIC_IF_ENV_KEY, targets);
  return Boolean(envVar) && process.env[envVar] === 'true';
}
