import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { cn } from '@/lib/utils';

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** sentence case, e.g. "Add rate version" */
  title: string;
  /** what the record means or who approves it, behind an ⓘ beside the title (never a paragraph) */
  info?: ReactNode;
  /** 672 px for two-column forms; 560 px otherwise */
  wide?: boolean;
  testId?: string;
  /** the form: its red alert on top, Cancel then the primary button at the bottom right */
  children: ReactNode;
}

const FIELD = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * The entry dialog of the Setup › Calendars, Profiles and Valuation pages: title with an optional ⓘ, the
 * first field focused on open (not the ⓘ), h-9 inputs and selects, Esc closes, the body scrolls.
 */
export function FormDialog({ open, onOpenChange, title, info, wide, testId, children }: FormDialogProps) {
  const body = useRef<HTMLDivElement>(null);
  const focusFirstField = (event: Event) => {
    const first = body.current?.querySelector<HTMLElement>(FIELD);
    if (!first) return;
    event.preventDefault();
    first.focus();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[90vh] flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-[560px]')} data-testid={testId} aria-describedby={undefined} onOpenAutoFocus={focusFirstField}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            {info && <KpiInfo label="this entry" text={info} />}
          </div>
        </DialogHeader>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-1 pb-1 [&_input]:h-9 [&_select]:h-9">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
