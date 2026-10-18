import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { typedMonthMatches } from '../model/month-label';
import { RequiredMarker } from '@/features/ux-kit/form-field';

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
  /** an irreversible step: the user types this text (the month as shown) before confirming */
  typedConfirmation?: string;
  /** resolves when the step succeeded (closes the dialog); rejects to keep it open */
  onConfirm: (text: string) => Promise<unknown>;
  children?: ReactNode;
}

/** A month close step behind a confirmation with a comment (or a required reason). */
export function StepConfirm({ trigger, testId, title, description, confirmLabel, textRequired, disabled, destructive, typedConfirmation, onConfirm, children }: StepConfirmProps) {
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const id = useId();
  const typedMissing = typedConfirmation !== undefined && !typedMonthMatches(typed, typedConfirmation);
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
      confirmDisabled={(textRequired ? !text.trim() : false) || typedMissing}
      onConfirm={() =>
        onConfirm(text.trim()).then(() => {
          setText('');
          setTyped('');
        })
      }
    >
      {typedConfirmation !== undefined && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-typed`}>
            Type <strong>{typedConfirmation}</strong> to confirm
          </Label>
          <Input id={`${id}-typed`} autoComplete="off" data-testid={`${testId}-confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={id}>{textRequired ? <>Reason<RequiredMarker /></> : 'Comment (optional)'}</Label>
        <Textarea id={id} rows={3} data-testid={`${testId}-text`} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {children}
    </ConfirmDialog>
  );
}
