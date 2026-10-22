import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface AddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** wider content for forms with two columns */
  wide?: boolean;
  testId?: string;
  /** the form: its red alert on top, its own submit button at the bottom */
  children: ReactNode;
}

/**
 * The "+ Add …" dialog of a Setup table page (SETUP_UX_FIXES Phase 4): a small record's form opened from
 * the page header, scrolling inside the dialog when it is long. The form shows a refusal as the red alert
 * at its top (the dialog stays open, input kept) and reports a success itself (toast, or the result dialog
 * through `useAddDialog().saved`).
 *
 * @example
 * <AddDialog open={add.isOpen} onOpenChange={add.setOpen} title="Add dictionary entry"><DictionaryEntryForm … /></AddDialog>
 */
export function AddDialog({ open, onOpenChange, title, description, wide, testId, children }: AddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('flex max-h-[90vh] flex-col', wide && 'sm:max-w-2xl')}
        data-testid={testId}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
