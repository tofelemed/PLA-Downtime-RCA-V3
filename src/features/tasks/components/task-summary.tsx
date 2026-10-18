import type { TaskSummaryView } from '@/api/v2/types/administration';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const TILES: ReadonlyArray<{ key: keyof Omit<TaskSummaryView, 'asOf'>; label: string }> = [
  { key: 'total', label: 'All tasks' },
  { key: 'open', label: 'Open' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];

export interface TaskSummaryProps {
  summary: TaskSummaryView | undefined;
  loading: boolean;
  /** the failed summary call; the tiles give way to the error with a retry */
  error?: unknown;
  isError?: boolean;
  onRetry?: () => void;
}

/** Task counts of the current filters, counted by the server. */
export function TaskSummary({ summary, loading, error, isError = false, onRetry }: TaskSummaryProps) {
  const { number } = useNumberFormat();
  if (isError) return <DataState state={dataStateOf({ isLoading: false, isError, error })} error={error} onRetry={onRetry} />;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Task counts">
      {TILES.map((tile) => (
        <div key={tile.key} className="rounded-md border p-3">
          <dt className="text-xs text-muted-foreground">{tile.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {loading || !summary ? <Skeleton className="h-7 w-10" /> : number(summary[tile.key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
