/** Rejects with `TimeoutError` when `work` has not settled after `timeoutMs`. */
export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  label = 'operation',
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(label, timeoutMs)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Exponential backoff in seconds: `baseSeconds * 2^attempt`, capped (attempt counts from 0). */
export function backoffSeconds(
  attempt: number,
  baseSeconds: number,
  capSeconds: number,
): number {
  const exponent = Math.min(Math.max(attempt, 0), 30);
  return Math.min(baseSeconds * 2 ** exponent, capSeconds);
}

/** Positive integer from the environment, or `fallback`. */
export function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
