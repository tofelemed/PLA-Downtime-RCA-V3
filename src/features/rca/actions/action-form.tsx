import { useState } from 'react';
import { useCreateRcaAction } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { buildActionBody, EMPTY_ACTION_FORM, type ActionForm as Form } from '../model/action-form';

function NativeChoice(props: { id: string; label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select id={props.id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextInput(props: { id: string; label: string; value: string; onChange: (value: string) => void; inputMode?: 'numeric' | 'decimal' }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input id={props.id} inputMode={props.inputMode} value={props.value} maxLength={255} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

const asMetric = (value: string): Form['baselineMetric'] => (value === 'recurrences' || value === 'downtime_seconds' ? value : '');
const asCurrency = (value: string): Form['claimedCurrency'] => (value === 'IRR' || value === 'USD' ? value : '');

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
    <fieldset className="grid gap-3 rounded border p-3 md:grid-cols-3" data-testid="action-form">
      <legend className="px-1 text-sm font-medium">New action (owner: you)</legend>
      <TextInput id="action-title" label="Action" value={form.title} onChange={(title) => set({ title })} />
      <DateInput id="action-due" label="Due" value={form.dueDate} onChange={(dueDate) => set({ dueDate })} />
      <DateInput id="action-window-start" label="Verify from" value={form.windowStart} onChange={(windowStart) => set({ windowStart })} />
      <DateInput id="action-window-end" label="Verify until" value={form.windowEnd} onChange={(windowEnd) => set({ windowEnd })} />
      <NativeChoice
        id="action-baseline"
        label="Baseline metric"
        value={form.baselineMetric}
        options={[['', 'None'], ['recurrences', 'Recurrences'], ['downtime_seconds', 'Downtime']]}
        onChange={(value) => set({ baselineMetric: asMetric(value) })}
      />
      <TextInput id="action-baseline-days" label="Baseline days" inputMode="numeric" value={form.baselineDays} onChange={(baselineDays) => set({ baselineDays })} />
      <TextInput id="action-baseline-value" label="Declared baseline (empty = count history)" inputMode="decimal" value={form.baselineValue} onChange={(baselineValue) => set({ baselineValue })} />
      <TextInput id="action-claim" label="Claimed avoided loss" inputMode="decimal" value={form.claimed} onChange={(claimed) => set({ claimed })} />
      <NativeChoice
        id="action-claim-currency"
        label="Claim currency"
        value={form.claimedCurrency}
        options={[['', 'No currency'], ['IRR', 'IRR'], ['USD', 'USD']]}
        onChange={(value) => set({ claimedCurrency: asCurrency(value) })}
      />
      <div className="space-y-2 md:col-span-3">
        {create.error ? <FriendlyErrorAlert error={create.error} /> : null}
        <Button size="sm" disabled={form.title.trim() === '' || create.isPending} onClick={() => void submit()} data-testid="add-action">
          Add action
        </Button>
      </div>
    </fieldset>
  );
}
