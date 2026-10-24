import { useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { cn } from '@/lib/utils';

/** Dialog widths of the case pages: md 560 px for short forms, lg 720 px for multi-field editors. */
const SIZE_CLASS = { md: 'sm:max-w-[560px]', lg: 'sm:max-w-[720px]' } as const;

const FIRST_FIELD = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[role=combobox]:not([disabled])';

export interface ToolDialogProps {
  title: string;
  /** what the dialog is for, behind an ⓘ next to the title (no paragraphs in the body) */
  info?: ReactNode;
  /** one short line under the title, e.g. the category the cause is added to */
  description?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** the primary verb, e.g. "Add cause" */
  submitLabel: string;
  submitDisabled?: boolean;
  submitTestId?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The form dialog of the analysis tools: sentence-case title with an optional ⓘ, labelled fields, Cancel left
 * of the primary action. The first field gets focus on open, Esc / Cancel close, Enter in a one-line field submits.
 */
export function ToolDialog({ title, info, description, size = 'md', submitLabel, submitDisabled, submitTestId, onSubmit, onClose, children }: ToolDialogProps) {
  const form = useRef<HTMLFormElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!submitDisabled) onSubmit();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn('max-h-[90vh] overflow-y-auto', SIZE_CLASS[size])}
        onOpenAutoFocus={(event) => {
          const first = form.current?.querySelector<HTMLElement>(FIRST_FIELD);
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form ref={form} className="space-y-4" onSubmit={submit} noValidate>
          <div className="grid gap-3">{children}</div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-9" disabled={submitDisabled} data-testid={submitTestId}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
