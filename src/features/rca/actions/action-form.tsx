import { useState } from 'react';
import { useCreateRcaAction } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { RCA_ACTION_TYPES } from '@/api/v2/types/rca-workflow';
import { RCA_ACTION_TYPE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { useRcaFormat } from '../use-rca-format';
import { asActionType, buildActionBody, EMPTY_ACTION_FORM, type ActionForm as Form } from '../model/action-form';

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

function TextInput(props: { id: string; label: string; value: string; onChange: (value: string) => void; inputMode?: 'numeric' | 'decimal'; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input id={props.id} inputMode={props.inputMode} value={props.value} maxLength={255} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

const TYPE_OPTIONS: Array<[string, string]> = [['', 'Not chosen yet'], ...RCA_ACTION_TYPES.map((type): [string, string] => [type, RCA_ACTION_TYPE_LABELS[type]])];

const asMetric = (value: string): Form['baselineMetric'] => (value === 'recurrences' || value === 'downtime_seconds' ? value : '');
const asCurrency = (value: string): Form['claimedCurrency'] => (value === 'IRR' || value === 'USD' ? value : '');

/**
 * New action with owner (you), type, due date, verification window, baseline metric and an optional claim.
 * The baseline itself is counted by the server from the history before the window.
 */
export function ActionForm({ rcaId }: { rcaId: string }) {
  const { session } = useAuth();
  const { timezone } = useRcaFormat();
  const create = useCreateRcaAction();
  const [form, setForm] = useState<Form>(EMPTY_ACTION_FORM);
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const submit = async () => {
    const created = await create.submit({ rcaId, body: buildActionBody(form, session?.user.id ?? null, timezone) }).catch(() => null);
    if (created) setForm(EMPTY_ACTION_FORM);
  };
  return (
    <fieldset className="grid gap-3 rounded border p-3 md:grid-cols-3" data-testid="action-form">
      <legend className="px-1 text-sm font-medium">New action (owner: you)</legend>
      <TextInput id="action-title" label="Action" value={form.title} onChange={(title) => set({ title })} />
      <NativeChoice id="action-type" label="Type of action" value={form.actionType} options={TYPE_OPTIONS} onChange={(value) => set({ actionType: asActionType(value) })} />
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
      <TextInput id="action-baseline-days" label="Baseline lookback (days)" inputMode="numeric" placeholder="RCA policy default" value={form.baselineDays} onChange={(baselineDays) => set({ baselineDays })} />
      <TextInput id="action-claim" label="Claimed avoided loss" inputMode="decimal" value={form.claimed} onChange={(claimed) => set({ claimed })} />
      <NativeChoice
        id="action-claim-currency"
        label="Claim currency"
        value={form.claimedCurrency}
        options={[['', 'No currency'], ['IRR', 'IRR'], ['USD', 'USD']]}
        onChange={(value) => set({ claimedCurrency: asCurrency(value) })}
      />
      <div className="space-y-2 md:col-span-3">
        <p className="text-xs text-muted-foreground">The baseline is counted by the server from the same-mode history before the verification window.</p>
        {create.error ? <RcaErrorAlert error={create.error} /> : null}
        <Button size="sm" disabled={form.title.trim() === '' || create.isPending} onClick={() => void submit()} data-testid="add-action">
          Add action
        </Button>
      </div>
    </fieldset>
  );
}
