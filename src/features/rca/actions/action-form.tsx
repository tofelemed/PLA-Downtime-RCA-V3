import { useState, type ReactNode } from 'react';
import { useCreateRcaAction } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { RCA_ACTION_TYPES } from '@/api/v2/types/rca-workflow';
import { RCA_ACTION_TYPE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { useRcaFormat } from '../use-rca-format';
import { asActionType, buildActionBody, EMPTY_ACTION_FORM, verifierIsOwner, type ActionForm as Form } from '../model/action-form';
import { useOptionalCaseWorkspace } from '../case/case-context';
import { NATIVE_SELECT_CLASS } from './native-select';
import { OwnerSelect } from './owner-select';
import { RecommendationSelect } from './recommendation-select';
import { VerificationPlanFields } from './verification-plan-fields';

function NativeChoice(props: { id: string; label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; info?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={props.id}>{props.label}</Label>
        {props.info && <KpiInfo label={props.label} text={props.info} />}
      </div>
      <select id={props.id} className={NATIVE_SELECT_CLASS} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
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
      <Input id={props.id} className="h-9" inputMode={props.inputMode} value={props.value} maxLength={255} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

const TYPE_OPTIONS: Array<[string, string]> = [['', 'Not chosen yet'], ...RCA_ACTION_TYPES.map((type): [string, string] => [type, RCA_ACTION_TYPE_LABELS[type]])];
const BASELINE_INFO = 'The baseline is counted by the server from the same-mode history before the verification window.';

const asMetric = (value: string): Form['baselineMetric'] => (value === 'recurrences' || value === 'downtime_seconds' ? value : '');
const asCurrency = (value: string): Form['claimedCurrency'] => (value === 'IRR' || value === 'USD' ? value : '');

/**
 * New action with owner (you by default; any member of the plant), type, due date, verification method and
 * verifier, verification window,
 * baseline metric and an optional claim. The baseline itself is counted by the server from the history
 * before the window.
 */
export function ActionForm({ rcaId, recommendationId = '' }: { rcaId: string; recommendationId?: string }) {
  const { session } = useAuth();
  const { timezone } = useRcaFormat();
  const create = useCreateRcaAction();
  const recommendations = useOptionalCaseWorkspace()?.rca.recommendations ?? [];
  const initial: Form = { ...EMPTY_ACTION_FORM, ownerId: session?.user.id ?? '', recommendationId };
  const [form, setForm] = useState<Form>(initial);
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  useUnsavedChangesGuard(JSON.stringify(form) !== JSON.stringify(initial));
  const submit = async () => {
    const created = await create.submit({ rcaId, body: buildActionBody(form, timezone) }).catch(() => null);
    if (created) setForm(initial);
  };
  return (
    <fieldset className="grid min-w-0 gap-4 md:grid-cols-3" data-testid="action-form">
      <legend className="sr-only">New action</legend>
      <TextInput id="action-title" label="Action" value={form.title} onChange={(title) => set({ title })} />
      <OwnerSelect id="action-owner" value={form.ownerId} onChange={(ownerId) => set({ ownerId })} />
      <NativeChoice id="action-type" label="Type of action" value={form.actionType} options={TYPE_OPTIONS} onChange={(value) => set({ actionType: asActionType(value) })} />
      {recommendations.length > 0 && (
        <RecommendationSelect id="action-recommendation" value={form.recommendationId} recommendations={recommendations} onChange={(value) => set({ recommendationId: value })} />
      )}
      <DateInput id="action-due" label="Due" compact value={form.dueDate} onChange={(dueDate) => set({ dueDate })} />
      <VerificationPlanFields idPrefix="action" value={form} onChange={set} />
      <DateInput id="action-window-start" label="Verify from" compact value={form.windowStart} onChange={(windowStart) => set({ windowStart })} />
      <DateInput id="action-window-end" label="Verify until" compact value={form.windowEnd} onChange={(windowEnd) => set({ windowEnd })} />
      <NativeChoice
        id="action-baseline"
        label="Baseline metric"
        info={BASELINE_INFO}
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
        {create.error ? <RcaErrorAlert error={create.error} /> : null}
        <div className="flex justify-end border-t pt-3">
          <Button size="sm" disabled={form.title.trim() === '' || verifierIsOwner(form) || create.isPending} onClick={() => void submit()} data-testid="add-action">
            Add action
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
