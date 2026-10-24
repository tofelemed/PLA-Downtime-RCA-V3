import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { KpiInfo } from './kpi-info';

export interface KpiTileSpec {
  title: string;
  info: string;
  highlight?: boolean;
}

export interface KpiTileProps {
  spec: KpiTileSpec;
  /** null renders "—"; the reason for the gap belongs in `spec.info` */
  value: ReactNode | null;
  testId: string;
}

/** Grid for a section's tiles. */
export function KpiTileRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5', className)}>{children}</div>;
}

/** One figure: small uppercase label with its ⓘ, large value. No change/previous-period line. */
export function KpiTile({ spec, value, testId }: KpiTileProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'min-w-0 rounded-md border bg-canvas p-3',
        spec.highlight && 'border-primary shadow-[inset_3px_0_0_hsl(var(--primary))]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">{spec.title}</span>
        <KpiInfo label={spec.title} text={spec.info} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value ?? '—'}</div>
    </div>
  );
}
