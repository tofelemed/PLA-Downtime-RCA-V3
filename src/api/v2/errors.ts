/** API03 error envelope of every v2 response (server/pro-act-backend/src/v2/CONVENTIONS.md §7). */
export interface FieldError {
  field: string;
  message: string;
  constraint?: string;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  correlationId: string | null;
  retryable: boolean;
}

/** A failed v2 call: status plus the parsed envelope (never a stack trace or token). */
export class V2ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];
  readonly correlationId: string | null;
  readonly retryable: boolean;

  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.message);
    this.name = 'V2ApiError';
    this.status = status;
    this.code = envelope.code;
    this.fieldErrors = envelope.fieldErrors ?? [];
    this.correlationId = envelope.correlationId;
    this.retryable = envelope.retryable;
  }

  /** `{ field: message }` for react-hook-form `setError` and inline form messages. */
  fieldErrorMap(): Record<string, string> {
    return Object.fromEntries(this.fieldErrors.map((error) => [error.field, error.message]));
  }
}

/** 412 STALE_REVISION: someone changed the resource since it was read; refetch and retry. */
export class StaleRevisionError extends V2ApiError {
  /** revision the server holds now, when the response names it (ETag or message) */
  readonly latestRevision: number | null;

  constructor(envelope: ErrorEnvelope, latestRevision: number | null) {
    super(412, envelope);
    this.name = 'StaleRevisionError';
    this.latestRevision = latestRevision;
  }
}

/** The session could not be renewed (401 after a refresh attempt): the user must sign in again. */
export class SessionExpiredError extends V2ApiError {
  constructor(envelope: ErrorEnvelope) {
    super(401, envelope);
    this.name = 'SessionExpiredError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function fieldErrorsOf(value: unknown): FieldError[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map((entry) => ({
    field: String(entry.field ?? ''),
    message: String(entry.message ?? ''),
    constraint: typeof entry.constraint === 'string' ? entry.constraint : undefined,
  }));
}

/** Envelope from any body; a non-envelope body (proxy page, network error) becomes a generic one. */
export function parseErrorEnvelope(
  status: number,
  body: unknown,
  fallbackCorrelationId: string | null,
): ErrorEnvelope {
  if (isRecord(body) && typeof body.code === 'string') {
    return {
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
      fieldErrors: fieldErrorsOf(body.fieldErrors),
      correlationId: typeof body.correlationId === 'string' ? body.correlationId : fallbackCorrelationId,
      retryable: body.retryable === true,
    };
  }
  return {
    code: status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`,
    message: `Request failed with status ${status}`,
    correlationId: fallbackCorrelationId,
    retryable: status === 429 || status === 503,
  };
}

/** Latest revision from a quoted ETag (`"7"`) or a "current revision 7" message. */
export function latestRevisionOf(etag: string | null, message: string): number | null {
  const fromEtag = etag ? Number(etag.replace(/^W\//, '').replace(/"/g, '')) : Number.NaN;
  if (Number.isInteger(fromEtag)) return fromEtag;
  const match = /current revision (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
}

export function toV2Error(
  status: number,
  body: unknown,
  etag: string | null,
  correlationId: string | null,
): V2ApiError {
  const envelope = parseErrorEnvelope(status, body, correlationId);
  if (status === 412) return new StaleRevisionError(envelope, latestRevisionOf(etag, envelope.message));
  return new V2ApiError(status, envelope);
}
