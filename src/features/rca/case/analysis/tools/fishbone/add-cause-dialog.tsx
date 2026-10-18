import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LIKELIHOODS } from '../../../../model/analysis-settings';
import { ChoiceField, optionsOf } from '../../../evidence/form-controls';

export interface NewCause {
  description: string;
  likelihood: string;
  isPrimary: boolean;
}

/** Short dialog: one contributing cause for a fishbone category. */
export function AddCauseDialog({ category, onAdd, onClose }: { category: string; onAdd: (cause: NewCause) => void; onClose: () => void }) {
  const [cause, setCause] = useState<NewCause>({ description: '', likelihood: 'Medium', isPrimary: false });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a cause</DialogTitle>
          <DialogDescription>Category: {category}. Be specific, e.g. "Lubrication interval too long", not "Poor maintenance".</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cause-description">Cause</Label>
            <Textarea id="cause-description" value={cause.description} maxLength={1000} onChange={(e) => setCause({ ...cause, description: e.target.value })} />
          </div>
          <ChoiceField id="cause-likelihood" label="Likelihood" value={cause.likelihood} options={optionsOf(LIKELIHOODS)} onChange={(likelihood) => setCause({ ...cause, likelihood })} />
          <div className="flex items-center gap-2">
            <Checkbox id="cause-primary" checked={cause.isPrimary} onCheckedChange={(value) => setCause({ ...cause, isPrimary: value === true })} />
            <Label htmlFor="cause-primary">Primary cause (a major contributor)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={cause.description.trim() === ''} onClick={() => onAdd({ ...cause, description: cause.description.trim() })}>
            Add cause
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
