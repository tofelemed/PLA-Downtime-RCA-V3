import { RequestMethod, Type } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { READ_ONLY_ALLOWED_KEY } from '../../auth/decorators/read-only-allowed.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface RouteGuardEntry {
  controller: string;
  handler: string;
  method: string;
  path: string;
  version?: string;
  guarded: boolean;
  isPublic: boolean;
  /** `@ReadOnlyAllowed()`: a read-only (`viewer`) caller may use this mutating route (plan 3.11) */
  readOnlyAllowed: boolean;
}

export interface InventoryOptions {
  /**
   * An authentication guard is registered as `APP_GUARD` (AppModule): every route not marked
   * `@Public()` counts as guarded. `@PublicIf()` routes stay guarded unless their env flag opens them.
   */
  globalGuard?: boolean;
}

/** Walks controller metadata the way Nest's route explorer does and reports guard coverage per route. */
export function inventoryRoutes(
  controllers: Array<Type<unknown>>,
  options: InventoryOptions = {},
): RouteGuardEntry[] {
  return controllers
    .flatMap((controller) => routesOf(controller))
    .map((entry) =>
      options.globalGuard && !entry.isPublic
        ? { ...entry, guarded: true }
        : entry,
    );
}

/**
 * Routes that are neither guarded nor explicitly public. A public route must carry `@Public()` AND be
 * listed in the allowlist, so neither a stray decorator nor a stale list opens a route on its own.
 */
export function findUnprotectedRoutes(
  entries: RouteGuardEntry[],
  publicAllowlist: ReadonlySet<string>,
): RouteGuardEntry[] {
  return entries.filter(
    (entry) =>
      !entry.guarded &&
      !(entry.isPublic && publicAllowlist.has(routeKey(entry))),
  );
}

export function routeKey(
  entry: Pick<RouteGuardEntry, 'controller' | 'handler'>,
): string {
  return `${entry.controller}.${entry.handler}`;
}

function routesOf(controller: Type<unknown>): RouteGuardEntry[] {
  const classPath = normalizePath(
    Reflect.getMetadata(PATH_METADATA, controller),
  );
  const classGuarded = hasGuards(
    Reflect.getMetadata(GUARDS_METADATA, controller),
  );
  const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
  const classReadOnly =
    Reflect.getMetadata(READ_ONLY_ALLOWED_KEY, controller) === true;
  const version = normalizeVersion(
    Reflect.getMetadata(VERSION_METADATA, controller),
  );
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    )
    .flatMap((name) => {
      const handler = prototype[name] as (...args: unknown[]) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined) {
        return [];
      }
      return [
        {
          controller: controller.name,
          handler: name,
          method: RequestMethod[requestMethod],
          path:
            `${classPath}${normalizePath(Reflect.getMetadata(PATH_METADATA, handler))}` ||
            '/',
          version,
          guarded:
            classGuarded ||
            hasGuards(Reflect.getMetadata(GUARDS_METADATA, handler)),
          isPublic:
            classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
          readOnlyAllowed:
            classReadOnly ||
            Reflect.getMetadata(READ_ONLY_ALLOWED_KEY, handler) === true,
        },
      ];
    });
}

function normalizePath(raw: unknown): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string' || first === '' || first === '/') {
    return '';
  }
  return first.startsWith('/') ? first : `/${first}`;
}

function normalizeVersion(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    return raw;
  }
  return Array.isArray(raw) && typeof raw[0] === 'string' ? raw[0] : undefined;
}

function hasGuards(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}
