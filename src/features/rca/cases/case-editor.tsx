import { useState } from 'react';
import { useUpdateRcaCase } from '@/api/v2/queries/rca-commands';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommandError } from '@/features/event-hub/components/command-error';
import { buildRcaCaseBody, formFromCase, type RcaCaseForm } from '../model/rca-form';
import { LogicTreeEditor } from './logic-tree-editor';
import { EvidenceItemsEditor, RecommendationItemsEditor } from './nested-items-editor';
import { PrioritySelect, StatusSelect } from './status-fields';

/**
 * The case form (plan 3.9 step 1): every field and the nested recommendations / evidence / logic tree
 * save in one PATCH with If-Match. Closing feeds the knowledge base and completes linked events.
 */
export function CaseEditor({ rca }: { rca: RcaCaseView }) {
  const update = useUpdateRcaCase();
  const [base, setBase] = useState(rca);
  const [form, setForm] = useState<RcaCaseForm>(() => formFromCase(rca));
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<RcaCaseForm>) => {
    setSaved(false);
    setForm((current) => ({ ...current, ...patch }));
  };
  const save = async () => {
    const result = await update.submit({ rca: base, body: buildRcaCaseBody(form) }).catch(() => null);
    if (result) {
      setBase(result);
      setForm(formFromCase(result));
      setSaved(true);
    }
  };
  return (
    <div className="space-y-4" data-testid="case-editor">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" value={form.title} maxLength={255} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <StatusSelect id="edit-status" value={form.status} onChange={(status) => set({ status })} />
        <PrioritySelect id="edit-priority" value={form.priority} onChange={(priority) => set({ priority })} />
        <div className="space-y-1">
          <Label htmlFor="edit-target">Target close date</Label>
          <Input
            id="edit-target"
            type="date"
            value={form.targetCloseDate.slice(0, 10)}
            onChange={(e) => set({ targetCloseDate: e.target.value ? new Date(`${e.target.value}T00:00:00Z`).toISOString() : '' })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="edit-description">Problem statement</Label>
          <Textarea id="edit-description" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="edit-root-cause">Root cause (a person's finding; automation never sets it)</Label>
          <Textarea id="edit-root-cause" value={form.rootCause} onChange={(e) => set({ rootCause: e.target.value })} />
        </div>
      </div>
      <RecommendationItemsEditor items={form.recommendations} onChange={(recommendations) => set({ recommendations })} />
      <EvidenceItemsEditor items={form.evidence} onChange={(evidence) => set({ evidence })} />
      <LogicTreeEditor nodes={form.logicTree} onChange={(logicTree) => set({ logicTree })} />
      <CommandError error={update.error} />
      <div className="flex items-center gap-2">
        <Button disabled={form.title.trim() === '' || update.isPending} onClick={() => void save()} data-testid="save-case">
          Save case
        </Button>
        {saved && <span role="status" className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </div>
  );
}
