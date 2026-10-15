import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';

export interface StepConfirmProps {
  trigger: string;
  testId: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** a reason the server requires (reopen); otherwise the comment is optional */
  textRequired?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  /** resolves when the step succeeded (closes the dialog); rejects to keep it open */
  onConfirm: (text: string) => Promise<unknown>;
  children?: ReactNode;
}

/** A month close step behind a confirmation with a comment (or a required reason). */
export function StepConfirm({ trigger, testId, title, description, confirmLabel, textRequired, disabled, destructive, onConfirm, children }: StepConfirmProps) {
  const [text, setText] = useState('');
  const id = useId();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant={destructive ? 'outline' : 'default'} data-testid={testId} disabled={disabled}>
          {trigger}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      confirmDisabled={textRequired ? !text.trim() : false}
      onConfirm={() => onConfirm(text.trim()).then(() => setText(''))}
    >
      <div className="space-y-1">
        <Label htmlFor={id}>{textRequired ? 'Reason (required)' : 'Comment (optional)'}</Label>
        <Textarea id={id} rows={3} data-testid={`${testId}-text`} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {children}
    </ConfirmDialog>
  );
}
