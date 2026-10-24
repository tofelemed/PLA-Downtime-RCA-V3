import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';
import { LIKELIHOODS } from '../../../../model/analysis-settings';
import { ChoiceSelect } from '../tool-fields';
import { choicesOf } from '../tool-choices';
import { ToolDialog } from '../tool-dialog';

export interface NewCause {
  description: string;
  likelihood: string;
  isPrimary: boolean;
}

/** Short dialog: one contributing cause for a fishbone category; an empty cause is refused under the field. */
export function AddCauseDialog({ category, onAdd, onClose }: { category: string; onAdd: (cause: NewCause) => void; onClose: () => void }) {
  const [cause, setCause] = useState<NewCause>({ description: '', likelihood: 'Medium', isPrimary: false });
  const [tried, setTried] = useState(false);
  const missing = cause.description.trim() === '';
  const submit = () => {
    setTried(true);
    if (!missing) onAdd({ ...cause, description: cause.description.trim() });
  };
  return (
    <ToolDialog
      title="Add cause"
      info={'Be specific, e.g. "Lubrication interval too long", not "Poor maintenance".'}
      description={`Category: ${category}`}
      submitLabel="Add cause"
      submitTestId="save-cause"
      onSubmit={submit}
      onClose={onClose}
    >
      <FormField id="cause-description" label="Cause" required error={tried && missing ? 'Describe the cause.' : null}>
        <Textarea id="cause-description" rows={3} value={cause.description} maxLength={1000} onChange={(e) => setCause({ ...cause, description: e.target.value })} />
      </FormField>
      <ChoiceSelect id="cause-likelihood" label="Likelihood" value={cause.likelihood} options={choicesOf(LIKELIHOODS)} onChange={(likelihood) => setCause({ ...cause, likelihood })} />
      <div className="flex items-center gap-2">
        <Checkbox id="cause-primary" checked={cause.isPrimary} onCheckedChange={(value) => setCause({ ...cause, isPrimary: value === true })} />
        <Label htmlFor="cause-primary">Primary cause (a major contributor)</Label>
      </div>
    </ToolDialog>
  );
}
