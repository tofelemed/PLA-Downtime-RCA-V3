import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const PUBLIC_IF_ENV_KEY = 'publicIfEnv';

/** Route needs no authentication (login, health, ...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Route is public only while the named environment variable is `'true'`
 * (e.g. `AUTH_ALLOW_PUBLIC_REGISTRATION` for local development); otherwise the
 * global guard chain applies as usual. A request that presents a bearer token is
 * never treated as anonymous on such a route: the token is verified and the role,
 * scope and rank rules apply exactly as when the route is closed.
 */
export const PublicIf = (envVar: string) =>
  SetMetadata(PUBLIC_IF_ENV_KEY, envVar);

/** Shared by every global guard so they agree on what "public" means. */
export function isPublicRoute(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  const targets = [context.getHandler(), context.getClass()];
  if (reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
    return true;
  }
  const envVar = reflector.getAllAndOverride<string>(
    PUBLIC_IF_ENV_KEY,
    targets,
  );
  if (!envVar || process.env[envVar] !== 'true') {
    return false;
  }
  return !carriesBearerToken(context);
}

function carriesBearerToken(context: ExecutionContext): boolean {
  if (context.getType() !== 'http') {
    return false;
  }
  const request = context
    .switchToHttp()
    .getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
  const header = request.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && /^bearer\s+\S/i.test(value);
}
