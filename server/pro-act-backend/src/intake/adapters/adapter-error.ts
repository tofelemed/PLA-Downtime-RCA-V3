/**
 * A source failure an adapter can classify (ING02 health). `retryable: false` fails the job at once
 * instead of burning the retry budget (lost credentials, missing permissions, a rejected request);
 * `health` is the code recorded on the job (`auth_failed`, `authz_failed` ...). The cursor never moves.
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly health: string | null = null,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/** The adapter error behind `error`, if it is one. */
export function adapterErrorOf(error: unknown): AdapterError | null {
  return error instanceof AdapterError ? error : null;
}
