import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { CommandError } from '../components/command-error';

export interface ReasonActionProps {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  error: unknown;
  testId: string;
  onConfirm: (reason: string) => Promise<unknown>;
}

/** A button opening a confirmation that asks why (the reason is kept with the decision and the revisions). */
export function ReasonAction({ label, title, description, confirmLabel, destructive, error, testId, onConfirm }: ReasonActionProps) {
  const [reason, setReason] = useState('');
  const id = useId();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" data-testid={testId}>
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      confirmDisabled={reason.trim() === ''}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <div className="space-y-1">
        <Label htmlFor={id}>Why (kept with the decision)</Label>
        <Textarea id={id} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </div>
      <CommandError error={error} />
    </ConfirmDialog>
  );
}
