import { useState } from 'react';
import { useCreateRcaCase } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommandError } from '@/features/event-hub/components/command-error';
import { buildRcaCaseBody, emptyCaseForm } from '../model/rca-form';
import { PrioritySelect } from './status-fields';
import { UnitSelect } from './unit-select';

export interface CreateCaseDialogProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

/** Opens a Draft case (reliability engineer / manager approver); events are linked afterwards. */
export function CreateCaseDialog({ onClose, onCreated }: CreateCaseDialogProps) {
  const create = useCreateRcaCase();
  const [form, setForm] = useState(() => emptyCaseForm(null));
  const submit = async () => {
    const created = await create.submit(buildRcaCaseBody(form)).catch(() => null);
    if (created) onCreated(created.id);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="create-case-dialog">
        <DialogHeader>
          <DialogTitle>New RCA case</DialogTitle>
          <DialogDescription>Starts as Draft; link events, approved loss lines or work orders from the case.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="case-title">Title</Label>
            <Input id="case-title" value={form.title} maxLength={255} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="case-description">Problem statement</Label>
            <Textarea id="case-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <UnitSelect id="case-unit" value={form.unitId} onChange={(unitId) => setForm({ ...form, unitId })} />
          <PrioritySelect id="case-priority" value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
        </div>
        <CommandError error={create.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={form.title.trim() === '' || create.isPending} onClick={() => void submit()}>Create case</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
