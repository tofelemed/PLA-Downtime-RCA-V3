import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { RequiredMarker } from '@/features/ux-kit/form-field';

export interface ReasonConfirmProps {
  /** label of the button that opens the dialog */
  trigger: ReactNode;
  triggerTestId: string;
  triggerVariant?: 'outline' | 'ghost' | 'default';
  disabled?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** resolves when the command succeeded (closes the dialog); rejects to keep it open */
  onConfirm: (reason: string) => Promise<unknown>;
  /** shown inside the dialog, e.g. the refusal of the last attempt */
  children?: ReactNode;
}

/** A workflow command that needs a reason: the reason is a required field of its confirmation dialog. */
export function ReasonConfirm({ trigger, triggerTestId, triggerVariant = 'outline', disabled, title, description, confirmLabel, destructive, onConfirm, children }: ReasonConfirmProps) {
  const [reason, setReason] = useState('');
  const id = useId();
  return (
    <ConfirmDialog
      trigger={
        <Button variant={triggerVariant} size="sm" data-testid={triggerTestId} disabled={disabled}>
          {trigger}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      confirmDisabled={!reason.trim()}
      onConfirm={() => onConfirm(reason.trim()).then(() => setReason(''))}
    >
      <div className="space-y-1">
        <Label htmlFor={id}>Reason<RequiredMarker /></Label>
        <Textarea id={id} rows={3} data-testid="wf-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {children}
    </ConfirmDialog>
  );
}
