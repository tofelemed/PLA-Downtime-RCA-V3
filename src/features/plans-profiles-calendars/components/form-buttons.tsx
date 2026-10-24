import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface FormButtonsProps {
  /** the primary button's label, e.g. "Add draft rate" */
  label: ReactNode;
  /** the primary click; left out, the primary is the `<form>`'s submit button (Enter submits too) */
  onSave?: () => void;
  onCancel: () => void;
  busy?: boolean;
  testId?: string;
}

/** The footer of a dialog form: Cancel then the primary action, right-aligned, both h-9 and never wrapping. */
export function FormButtons({ label, onSave, onCancel, busy = false, testId }: FormButtonsProps) {
  return (
    <div className="flex justify-end gap-2 pt-1" data-testid="form-buttons">
      <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type={onSave ? 'button' : 'submit'} size="sm" className="whitespace-nowrap" onClick={onSave} disabled={busy} data-testid={testId}>
        {label}
      </Button>
    </div>
  );
}
