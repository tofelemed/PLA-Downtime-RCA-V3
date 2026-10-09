import { v2Request, V2Response } from './client';
import { fillPath, QueryParams } from './request-url';
import {
  BodyOf,
  PathParamsOf,
  PathsWith,
  QueryOf,
  relativeV2Path,
  V2Path,
} from './schema-types';

type PathArgs<P extends V2Path, M extends 'get' | 'post' | 'put' | 'patch' | 'delete'> =
  [PathParamsOf<P, M>] extends [never] ? { path?: undefined } : { path: PathParamsOf<P, M> };

type GetArgs<P extends PathsWith<'get'>> = PathArgs<P, 'get'> & {
  query?: QueryOf<P, 'get'>;
  signal?: AbortSignal;
};

type CommandArgs<P extends V2Path, M extends 'post' | 'put' | 'patch'> = PathArgs<P, M> & {
  body?: BodyOf<P, M>;
  signal?: AbortSignal;
};

const target = (path: V2Path, params: unknown) =>
  fillPath(relativeV2Path(path), (params ?? {}) as Record<string, string>);

/**
 * Typed v2 calls over the generated OpenAPI paths: the path template, its path/query parameters and the
 * request body are checked against `schema.d.ts`; `T` names the response view (see `types/`).
 */
export const v2 = {
  get<T, P extends PathsWith<'get'>>(path: P, args: GetArgs<P>): Promise<V2Response<T>> {
    return v2Request<T>({
      method: 'GET',
      path: target(path, args.path),
      query: args.query as QueryParams | undefined,
      signal: args.signal,
    });
  },

  /**
   * POST command; `idempotencyKey` is the key of this attempt (see `idempotency.ts`); `ifMatch` for
   * commands on one revisioned resource (split, close: 412 when stale).
   */
  post<T, P extends PathsWith<'post'>>(
    path: P,
    args: CommandArgs<P, 'post'> & { idempotencyKey: string; ifMatch?: string },
  ): Promise<V2Response<T>> {
    return v2Request<T>({
      method: 'POST',
      path: target(path, args.path),
      body: args.body ?? {},
      idempotencyKey: args.idempotencyKey,
      ifMatch: args.ifMatch,
      signal: args.signal,
    });
  },

  /** PATCH of a revisioned resource: `ifMatch` is `"<rowVersion>"` or `'cached'` (last ETag read). */
  patch<T, P extends PathsWith<'patch'>>(
    path: P,
    args: CommandArgs<P, 'patch'> & { ifMatch: string },
  ): Promise<V2Response<T>> {
    return v2Request<T>({
      method: 'PATCH',
      path: target(path, args.path),
      body: args.body ?? {},
      ifMatch: args.ifMatch,
      signal: args.signal,
    });
  },

  put<T, P extends PathsWith<'put'>>(
    path: P,
    args: CommandArgs<P, 'put'> & { ifMatch?: string },
  ): Promise<V2Response<T>> {
    return v2Request<T>({
      method: 'PUT',
      path: target(path, args.path),
      body: args.body ?? {},
      ifMatch: args.ifMatch,
      signal: args.signal,
    });
  },
};
