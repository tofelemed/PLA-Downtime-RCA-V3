/**
 * Standard error envelope returned by every HTTP error response (spec API03).
 *
 * `message` is a string for most errors and a string[] for validation failures so the
 * existing frontend `ApiError` parser (which reads `body.message`) keeps working.
 */
export interface FieldError {
  field: string;
  message: string;
  constraint?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string | string[];
  fieldErrors?: FieldError[];
  correlationId: string;
  retryable: boolean;
}
