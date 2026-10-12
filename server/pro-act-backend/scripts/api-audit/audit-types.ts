/** Shared shapes of the API usage audit (scripts/api-audit, `npm run api:audit`). */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const MUTATING_METHODS: readonly HttpMethod[] = [
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

/** One HTTP call site in the frontend (`src/**`). */
export interface FrontendCall {
  method: HttpMethod;
  /** full path template, `/api/...`, parameters as `{name}` */
  path: string;
  /** `src/...:line` of the call expression */
  location: string;
  /** enclosing exported function / `class.method` */
  caller: string;
  client: 'v1' | 'v2';
  /** property names of the request body type (null = no body or not statically known) */
  bodyFields: string[] | null;
  /** true when the body type is open (`Record<string, unknown>`, `any`, ...) */
  bodyUntyped: boolean;
  queryFields: string[];
  sendsIdempotencyKey: boolean;
  sendsIfMatch: boolean;
  /** screens / components referencing the caller */
  usedBy: string[];
}

export interface DtoShape {
  name: string;
  fields: string[];
  required: string[];
}

/** One route registered in the Nest application. */
export interface BackendRoute {
  method: HttpMethod;
  /** `/api/...` with `{name}` parameters */
  path: string;
  controller: string;
  handler: string;
  /** `src/...:line` of the handler, when found */
  location: string;
  roles: string[];
  isPublic: boolean;
  idempotent: boolean;
  requiresIfMatch: boolean;
  body: DtoShape | null;
  /** `@Body('field')` single-field bodies */
  bodyFieldParams: string[];
}

export type DefectCategory =
  | 'missing-route'
  | 'shadowed-route'
  | 'method-mismatch'
  | 'body-mismatch'
  | 'missing-header'
  | 'live-404'
  | 'live-5xx'
  | 'live-auth'
  | 'live-4xx'
  | 'validation-missing'
  | 'absent-id'
  | 'retired-route'
  | 'large-payload'
  | 'slow';

export type Severity = 'high' | 'medium' | 'low';

export interface Defect {
  severity: Severity;
  category: DefectCategory;
  method: HttpMethod;
  path: string;
  frontend: string;
  backend: string;
  detail: string;
  fix: string;
  /** body fields the DTO does not whitelist (body-mismatch) */
  extraFields?: string[];
  /** live evidence (status / error of the confirming request) */
  evidence?: string;
}

export interface SmokeResult {
  method: HttpMethod;
  path: string;
  /** concrete URL path called */
  url: string;
  persona: string;
  kind: 'read' | 'validation' | 'create' | 'readback' | 'skipped';
  status: number | null;
  ms: number;
  bytes: number;
  note: string;
  /** error `code` / message of a failed response */
  error: string;
}
