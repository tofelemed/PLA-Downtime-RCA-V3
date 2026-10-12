import { V2ApiError } from '@/api/v2/errors';
import { ApiError } from '@/services/api/httpClient';

/** What any thrown value tells about a failed request, before it is put into words. */
export interface ErrorFacts {
  status: number | null;
  code: string | null;
  /** the server's own message, unchecked */
  serverMessage: string | null;
  correlationId: string | null;
  fieldErrors: ReadonlyArray<{ field: string; message: string }>;
  /** legacy validation messages (`message: string[]` of a v1 400) */
  messageList: readonly string[];
  /** no response at all (fetch `TypeError`) */
  network: boolean;
}

const EMPTY: ErrorFacts = {
  status: null,
  code: null,
  serverMessage: null,
  correlationId: null,
  fieldErrors: [],
  messageList: [],
  network: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const stringOrNull = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);
const NETWORK_TEXT = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

function fieldErrorsOf(value: unknown): ErrorFacts['fieldErrors'] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({ field: String(entry.field ?? ''), message: String(entry.message ?? '') }));
}

function v1Facts(error: ApiError): ErrorFacts {
  const body = isRecord(error.body) ? error.body : {};
  const list = Array.isArray(body.message) ? body.message.filter((m): m is string => typeof m === 'string') : [];
  return {
    ...EMPTY,
    status: error.status,
    code: stringOrNull(body.code),
    serverMessage: stringOrNull(body.message),
    correlationId: stringOrNull(body.correlationId),
    fieldErrors: fieldErrorsOf(body.fieldErrors),
    messageList: list,
  };
}

function v2Facts(error: V2ApiError): ErrorFacts {
  return {
    ...EMPTY,
    status: error.status,
    code: error.code,
    serverMessage: stringOrNull(error.message),
    correlationId: error.correlationId,
    fieldErrors: error.fieldErrors,
  };
}

/** Facts of a V2ApiError, a v1 ApiError, a network TypeError, a plain Error or a string. */
export function factsOf(error: unknown): ErrorFacts {
  if (error instanceof V2ApiError) return v2Facts(error);
  if (error instanceof ApiError) return v1Facts(error);
  if (error instanceof TypeError) return { ...EMPTY, network: NETWORK_TEXT.test(error.message) };
  if (error instanceof Error) {
    const programming = error instanceof ReferenceError || error instanceof SyntaxError || error instanceof RangeError;
    return { ...EMPTY, serverMessage: programming ? null : stringOrNull(error.message) };
  }
  if (typeof error === 'string') return { ...EMPTY, serverMessage: stringOrNull(error) };
  return EMPTY;
}
