# API v2 conventions — how to add a resource

Spec: API01–API04, WF05 (plan `plans/phase-0/0.4-api-v2-foundation.md`). Reference implementation:
`production-events/` in this folder. Everything in `src/v2/` is served under `/api/v2/...` and documented at
`/api/docs/v2`; v1 stays under `/api` and must not be changed by v2 work.

## 1. Controller

```ts
@ApiTags('v2 · <Resource>')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantQueryParamGuard)
@Controller({ path: '<resources>', version: '2' })
export class <Resource>V2Controller { ... }
```

- `version: '2'` + `app.enableVersioning({ type: VersioningType.URI })` produces `/api/v2/<resources>`.
- Register the controller and its service in `v2.module.ts` (the v2 Swagger document is generated from
  `V2Module` only).
- Every route is guarded. There is no `@Public()` in v2.

## 2. Tenant and scope come from identity, never from the query

- `resolveRequestTenantId(user, xTenantIdHeader)` (`src/auth/request-tenant.ts`) returns the token tenant;
  a SuperAdmin may select a tenant with `X-Tenant-Id`. Membership validation against `user_scopes`
  arrives with the tenancy tables (0.4 part 2) — do not add per-resource workarounds.
- `TenantQueryParamGuard` rejects any `tenantId` query parameter with 400 `TENANT_FROM_IDENTITY`.
- Every query starts with `.where('<alias>.tenantId = :tenantId')`. Foreign ids answer 404, not 403
  (no existence leak).

## 3. List queries

- Extend `ListQueryDto` (`common/list-query.dto.ts`): `cursor`, `limit` (1–500, default 100), `sort`,
  `from`, `to`.
- Redeclare `sort` with `@IsIn([...])` listing the allowed `field` / `-field` values, and pass the same
  allowlist to `parseSort()` in the service. Ordering is always `<sort field>, id` in the same direction.
- Array filters are repeated parameters (`?unitIds=a&unitIds=b`): declare them with
  `@Transform(toArrayParam) @IsArray() @ArrayMaxSize(n) @IsUUID('all', { each: true })`. OR within a
  parameter (`IN`), AND across parameters (`andWhere`).
- Booleans use `@Transform(toBooleanParam) @IsBoolean()` (the implicit conversion would turn `"false"`
  into `true`).
- Intervals use overlap semantics via `applyOverlapWindow()` (`src/common/query/overlap-window.ts`):
  `start < :to AND (end IS NULL OR end > :from)`; `from`/`to` are half-open; `from >= to` is 422
  `INVALID_RANGE`.

## 4. Pagination (keyset, never OFFSET)

- Fetch `limit + 1` rows ordered by `(sortField, id)`; if more came back, encode the last returned row with
  `CursorCodec.encode({ sortValue, id })` as `nextCursor`, otherwise `nextCursor: null`.
- Apply an incoming cursor as `(sortField < :s OR (sortField = :s AND id < :id))` (`>` for ascending).
  See `applyKeysetCursor()` in the reference endpoint.
- A malformed cursor is 400 `INVALID_CURSOR`. Cursors are opaque; never document their layout.

## 5. Responses

- Lists: `listResponse(items, nextCursor, { tenantId, unitIds? })` → `{ items, nextCursor, asOf, scope }`.
- Analytical endpoints: `AnalyticsResponse<T>` adds `calculationRunId, policyVersion, dataQuality, coverage,
  isProvisional`.
- Long-running work: return 202 with `JobAccepted { jobId, statusUrl }`.
- Decimals are strings: map with `toDecimalString()` in the view mapper, or use `@DecimalString()` on a
  class-transformer DTO, or `decimalStringTransformer` on `numeric` columns of new entities.
- Times are ISO 8601 UTC; durations are seconds.
- Return a dedicated view object (`<resource>-v2.view.ts`), never the entity.

## 6. Errors

Throw Nest exceptions; `ApiExceptionFilter` shapes them as
`{ code, message, fieldErrors?, correlationId, retryable }`. Pass `{ code, message }` as the exception
response to set a specific code (`INVALID_TRANSITION`, `STALE_REVISION`, ...). Validation failures on
`/api/v2` are 422 `VALIDATION_FAILED` with `fieldErrors`; semantic validation uses
`UnprocessableEntityException`. Never put stack traces or SQL in a response.

## 7. Tests

- Unit: DTO validation through `createValidationPipe()` (same options as production), cursor codec,
  pure query helpers.
- Integration (`test/integration/*.int-spec.ts`, real Postgres `proact_test`): tenant isolation
  (token of tenant B never sees tenant A rows), compound filter intersection, stable pagination while rows
  are inserted, limit bounds, `tenantId` query rejected, 401 without token.
- Add the route to the public allowlist test only if it is genuinely public (it never is in v2).

## 8. Checklist

- [ ] controller `{ path, version: '2' }`, both guards, registered in `V2Module`
- [ ] query DTO extends `ListQueryDto`, sort allowlist, array/boolean transformers
- [ ] service: tenant predicate first, `parseSort`, overlap window, keyset cursor, `limit + 1`
- [ ] view mapper with decimal strings and ISO times; `listResponse` envelope
- [ ] indexes exist for every filtered/sorted column (migration with `down()`)
- [ ] unit + integration tests; `/api/docs/v2` renders the new route
