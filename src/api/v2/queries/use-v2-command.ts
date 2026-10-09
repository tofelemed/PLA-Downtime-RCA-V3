import { useMutation, useQueryClient } from '@tanstack/react-query';
import { V2ApiError } from '../errors';
import { CommandAttempt, commandAttempt } from '../idempotency';
import { ChangeNotice, invalidateForChange } from './invalidation';

export interface V2CommandOptions<TInput, TResult> {
  /** performs the call; must send `attempt.idempotencyKey` on POST commands */
  run: (attempt: CommandAttempt<TInput>) => Promise<TResult>;
  /** what the command changed: the related cached results are invalidated on success */
  changes: (input: TInput, result: TResult) => ChangeNotice | ChangeNotice[] | null;
  /** automatic retries of transient failures; each retry re-sends the attempt's key */
  retries?: number;
}

const transient = (error: unknown) =>
  !(error instanceof V2ApiError) || error.retryable || error.status >= 500;

/**
 * A v2 command as a TanStack mutation (plan 3.1, API02): `submit(input)` starts one attempt with a fresh
 * Idempotency-Key; retries (network, 5xx, retryable codes) reuse it so the server replays instead of
 * acting twice; success invalidates the results the change touches. Never call it during render.
 */
export function useV2Command<TInput, TResult>(options: V2CommandOptions<TInput, TResult>) {
  const queryClient = useQueryClient();
  const mutation = useMutation<TResult, unknown, CommandAttempt<TInput>>({
    mutationFn: (attempt) => options.run(attempt),
    retry: (failures, error) => failures < (options.retries ?? 1) && transient(error),
    onSuccess: async (result, attempt) => {
      const changes = options.changes(attempt.input, result);
      const list = changes === null ? [] : Array.isArray(changes) ? changes : [changes];
      await Promise.all(list.map((notice) => invalidateForChange(queryClient, notice)));
    },
  });
  return {
    ...mutation,
    submit: (input: TInput) => mutation.mutateAsync(commandAttempt(input)),
  };
}
