import type { ReactNode } from 'react';
import { useState } from 'react';
import { useCreateRcaAction } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { CommandError } from '@/features/event-hub/components/command-error';
import { buildActionBody, EMPTY_ACTION_FORM, type ActionForm as Form } from '../model/action-form';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** New action with owner (you), due date, verification window, baseline and an optional claim. */
export function ActionForm({ rcaId }: { rcaId: string }) {
  const { session } = useAuth();
  const create = useCreateRcaAction();
  const [form, setForm] = useState<Form>(EMPTY_ACTION_FORM);
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const submit = async () => {
    const created = await create.submit({ rcaId, body: buildActionBody(form, session?.user.id ?? null) }).catch(() => null);
    if (created) setForm(EMPTY_ACTION_FORM);
  };
  return (
    <fieldset className="grid gap-2 rounded border p-2 md:grid-cols-3" data-testid="action-form">
      <legend className="px-1 text-sm font-medium">New action (owner: you)</legend>
      <Field id="action-title" label="Action">
        <Input id="action-title" value={form.title} maxLength={255} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field id="action-due" label="Due">
        <Input id="action-due" type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
      </Field>
      <Field id="action-window-start" label="Verify from">
        <Input id="action-window-start" type="date" value={form.windowStart} onChange={(e) => set({ windowStart: e.target.value })} />
      </Field>
      <Field id="action-window-end" label="Verify until">
        <Input id="action-window-end" type="date" value={form.windowEnd} onChange={(e) => set({ windowEnd: e.target.value })} />
      </Field>
      <Field id="action-baseline" label="Baseline metric">
        <select id="action-baseline" className="h-10 w-full rounded border px-2 text-sm" value={form.baselineMetric} onChange={(e) => set({ baselineMetric: e.target.value === 'recurrences' || e.target.value === 'downtime_seconds' ? e.target.value : '' })}>
          <option value="">None</option>
          <option value="recurrences">Recurrences</option>
          <option value="downtime_seconds">Downtime (s)</option>
        </select>
      </Field>
      <Field id="action-baseline-days" label="Baseline days">
        <Input id="action-baseline-days" inputMode="numeric" value={form.baselineDays} onChange={(e) => set({ baselineDays: e.target.value })} />
      </Field>
      <Field id="action-baseline-value" label="Declared baseline (empty = count history)">
        <Input id="action-baseline-value" inputMode="decimal" value={form.baselineValue} onChange={(e) => set({ baselineValue: e.target.value })} />
      </Field>
      <Field id="action-claim" label="Claimed avoided loss">
        <Input id="action-claim" inputMode="decimal" value={form.claimed} onChange={(e) => set({ claimed: e.target.value })} />
      </Field>
      <Field id="action-claim-currency" label="Claim currency">
        <select id="action-claim-currency" className="h-10 w-full rounded border px-2 text-sm" value={form.claimedCurrency} onChange={(e) => set({ claimedCurrency: e.target.value === 'IRR' || e.target.value === 'USD' ? e.target.value : '' })}>
          <option value="">—</option>
          <option value="IRR">IRR</option>
          <option value="USD">USD</option>
        </select>
      </Field>
      <div className="md:col-span-3">
        <CommandError error={create.error} />
        <Button size="sm" disabled={form.title.trim() === '' || create.isPending} onClick={() => void submit()} data-testid="add-action">Add action</Button>
      </div>
    </fieldset>
  );
}
