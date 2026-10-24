import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ToolCanvasProps {
  /** names the drawing area for assistive technology */
  label: string;
  /** buttons of the tool (h-9, icon + words); hidden on a read-only case by the caller */
  toolbar?: ReactNode;
  /** what the colours or marks of the drawing mean */
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The bordered drawing area of a diagram tool (fishbone, trees, event diagram, timeline): toolbar row, legend, content. */
export function ToolCanvas({ label, toolbar, legend, className, children }: ToolCanvasProps) {
  return (
    <div role="group" aria-label={label} className={cn('min-w-0 rounded-md border bg-background', className)}>
      {(toolbar || legend) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" data-testid="tool-toolbar">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {legend && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{legend}</div>}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
