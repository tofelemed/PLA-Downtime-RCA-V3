import { useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { StatusIcon } from '@/lib/icons';
import { DisabledReason } from './disabled-reason';

export interface ConfirmDialogProps {
  /** controlled usage; omit together with `onOpenChange` and pass `trigger` instead */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** uncontrolled usage: the element that opens the dialog (rendered `asChild`) */
  trigger?: ReactNode;
  title: string;
  description?: ReactNode;
  /** the verb of the action, e.g. "Retire profile" (never "OK" / "Yes") */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** a returned promise keeps the dialog open and busy; it closes on resolve and stays open on reject */
  onConfirm: () => void | Promise<unknown>;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** shown next to the buttons (and linked to the confirm button) while `confirmDisabled` is set */
  confirmDisabledReason?: string;
  /** extra content between description and buttons, e.g. a required reason field */
  children?: ReactNode;
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';

function useOpenState(open: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  return [isOpen, setOpen] as const;
}

function usePendingConfirm(onConfirm: ConfirmDialogProps['onConfirm'], close: () => void) {
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    const result = onConfirm();
    if (!isPromise(result)) return close();
    setPending(true);
    try {
      await result;
      close();
    } catch {
      // the caller owns the error message (toast / inline); the dialog stays open so the user can retry
    } finally {
      setPending(false);
    }
  };
  return { pending, confirm };
}

/**
 * Confirmation for destructive or irreversible actions, on ui/alert-dialog. The confirm button names
 * the action; while `onConfirm`'s promise runs it shows a spinner and the dialog cannot be dismissed.
 * Destructive dialogs focus Cancel first (safer default); others focus the confirm button. The body
 * scrolls so the buttons always stay on screen.
 *
 * @example
 * <ConfirmDialog trigger={<Button variant="outline">Retire</Button>} title="Retire this profile?"
 *   description="Plans keep their history." confirmLabel="Retire profile" destructive
 *   onConfirm={() => retire.submit(input)} />
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { title, description, confirmLabel, cancelLabel = 'Cancel', destructive = false, trigger, children } = props;
  const [isOpen, setOpen] = useOpenState(props.open, props.onOpenChange);
  const { pending, confirm } = usePendingConfirm(props.onConfirm, () => setOpen(false));
  const confirmRef = useRef<HTMLButtonElement>(null);
  const busy = pending || Boolean(props.busy);
  const reasonId = useId();
  const disabledReason = props.confirmDisabled ? props.confirmDisabledReason : undefined;
  return (
    <AlertDialog open={isOpen} onOpenChange={(next) => !busy && setOpen(next)}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent
        className="flex max-h-[min(90vh,44rem)] flex-col"
        onOpenAutoFocus={(event) => {
          if (destructive) return;
          event.preventDefault();
          confirmRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {description && (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          )}
          {children}
        </div>
        <DisabledReason id={reasonId} reason={disabledReason} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <Button
            ref={confirmRef}
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || props.confirmDisabled}
            aria-busy={busy || undefined}
            aria-describedby={disabledReason ? reasonId : undefined}
            onClick={() => void confirm()}
          >
            {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
