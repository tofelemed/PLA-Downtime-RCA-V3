const RECOMPUTE_LABELS: Readonly<Record<string, string>> = {
  queued: 'Recompute queued…',
  running: 'Recomputing…',
  completed: 'Recompute finished',
  failed: 'Recompute failed — try again',
};

/** The recompute job's state from the server (queued, running, finished, failed); nothing without a job. */
export function RecomputeState({ state, testId = 'recompute-state' }: { state: string | null; testId?: string }) {
  if (!state) return null;
  return (
    <span className="text-xs" role="status" data-testid={testId} data-state={state}>
      {RECOMPUTE_LABELS[state] ?? 'Recomputing…'}
    </span>
  );
}
