import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { cn } from '@/lib/utils';

/** Dialog widths: md 560 px for short forms, lg 720 px for multi-field forms. */
const SIZE_CLASS = { md: 'sm:max-w-[560px]', lg: 'sm:max-w-[720px]' } as const;

const FIRST_FIELD = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[role=combobox]:not([disabled])';

export interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the button that opens the dialog (rendered `asChild`); left out when the page opens it */
  trigger?: ReactNode;
  title: string;
  /** what the dialog is for, behind an ⓘ next to the title (no paragraphs in the body) */
  info?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Cancel, then the primary action, on the right */
  footer: ReactNode;
  testId?: string;
  children: ReactNode;
}

/**
 * The form dialog of the administration pages: sentence-case title with an optional ⓘ, labelled fields; the
 * first field gets focus on open, Esc closes.
 */
export function AdminDialog({ open, onOpenChange, trigger, title, info, size = 'md', footer, testId, children }: AdminDialogProps) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn('max-h-[90vh] overflow-y-auto', SIZE_CLASS[size])}
        aria-describedby={undefined}
        data-testid={testId}
        onOpenAutoFocus={(event) => {
          const first = body.current?.querySelector<HTMLElement>(FIRST_FIELD);
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            {info && <KpiInfo label={title} text={info} />}
          </div>
        </DialogHeader>
        <div ref={body} className="space-y-4">
          {children}
        </div>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
