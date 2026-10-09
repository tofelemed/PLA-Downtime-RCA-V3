import type { components, paths } from './schema';

/**
 * Type helpers over the generated OpenAPI v2 types (`schema.d.ts`, `npm run api:types`). The snapshot
 * types paths, query/path parameters and request bodies; response views live in `types/` until the
 * backend documents response schemas.
 */
export type V2Path = keyof paths;
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type OperationOf<P extends V2Path, M extends HttpMethod> = NonNullable<paths[P][M]>;

/** Paths that define method `M`. */
export type PathsWith<M extends HttpMethod> = {
  [P in V2Path]: paths[P][M] extends undefined ? never : P;
}[V2Path];

type ParametersOf<P extends V2Path, M extends HttpMethod> = OperationOf<P, M> extends {
  parameters: infer Params;
}
  ? Params
  : never;

export type QueryOf<P extends V2Path, M extends HttpMethod> = ParametersOf<P, M> extends {
  query?: infer Query;
}
  ? NonNullable<Query>
  : never;

export type PathParamsOf<P extends V2Path, M extends HttpMethod> = ParametersOf<P, M> extends {
  path: infer PathParams;
}
  ? PathParams
  : never;

/**
 * The backend documents nullable scalars (`@ApiPropertyOptional({ nullable: true })` without a `type`) as
 * an untyped object, which openapi-typescript renders `Record<string, never>`. Until the DTO docs name
 * their types, such fields accept a JSON scalar instead of nothing.
 */
type Untyped = Record<string, never>;
type RepairField<V> = [NonNullable<V>] extends [Untyped]
  ? Untyped extends NonNullable<V>
    ? string | number | boolean | null | Exclude<V, Untyped>
    : V
  : V;
export type RepairUntyped<T> = T extends object ? { [K in keyof T]: RepairField<T[K]> } : T;

export type BodyOf<P extends V2Path, M extends HttpMethod> = OperationOf<P, M> extends {
  requestBody: { content: { 'application/json': infer Body } };
}
  ? RepairUntyped<Body>
  : OperationOf<P, M> extends { requestBody?: { content: { 'application/json': infer Optional } } }
    ? RepairUntyped<Optional>
    : never;

export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name];

/** Path template relative to the v2 base (`/api/v2/x/{id}` → `/x/{id}`). */
export function relativeV2Path(path: V2Path): string {
  return String(path).replace(/^\/api\/v2/, '');
}
