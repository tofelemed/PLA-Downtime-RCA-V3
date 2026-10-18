import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChartFigureProps {
  /** one-sentence text alternative of what the chart shows (read by screen readers) */
  caption: string;
  /** show the caption under the chart as well (default: screen readers only) */
  captionVisible?: boolean;
  /** the same data as a table, behind a "View as table" disclosure */
  table?: ReactNode;
  tableLabel?: string;
  /** size of the drawing area (Recharts' ResponsiveContainer fills it), e.g. `h-64 w-full` */
  chartClassName?: string;
  className?: string;
  testId?: string;
  /** the drawing; hidden from assistive technology, which gets the caption and the table instead */
  children: ReactNode;
}

/** Accessible frame of a chart (H-6): `<figure>` + `<figcaption>` summary + optional "View as table". */
export function ChartFigure({ caption, captionVisible = false, table, tableLabel = 'View as table', chartClassName, className, testId, children }: ChartFigureProps) {
  const captionId = useId();
  return (
    <figure className={cn('space-y-2', className)} aria-labelledby={captionId} data-testid={testId}>
      <div className={chartClassName} aria-hidden="true">
        {children}
      </div>
      <figcaption id={captionId} className={captionVisible ? 'text-xs text-muted-foreground' : 'sr-only'}>
        {caption}
      </figcaption>
      {table && (
        <details>
          <summary className="cursor-pointer text-sm text-primary">{tableLabel}</summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}
