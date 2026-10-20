/**
 * True when an error is an authentication failure (HTTP 401): the v2 client's `V2ApiError` /
 * `SessionExpiredError` and the v1 `ApiError` all carry the status. Such an error ends the session (the login
 * screen follows) instead of showing the error page.
 */
export function isAuthFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  return (error as { status: unknown }).status === 401;
}
