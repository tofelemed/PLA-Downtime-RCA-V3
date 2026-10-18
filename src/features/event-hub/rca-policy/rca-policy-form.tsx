import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RcaErrorAlert } from '@/features/rca/components/rca-error-alert';
import { useCreateRcaPolicy, type RcaPolicyVersion } from './rca-policy-api';
import { draftOf, inputOf, type RcaPolicyDraft } from './rca-policy-draft';
import { rulesDraftOf, rulesInputOf, type RcaRulesDraft } from './rca-policy-rules-draft';
import { RcaPolicyRulesFields } from './rca-policy-rules-fields';
import { REPEAT_MATCH_LABELS } from './rca-policy-text';

type Set = <K extends keyof RcaPolicyDraft>(key: K, value: RcaPolicyDraft[K]) => void;

function NumberField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Choice<T extends string>(props: { id: string; label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select
        id={props.id}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The SME D17 production triggers: duration, lost quantity, repeats and cumulative downtime. */
function ProductionFields({ draft, set }: { draft: RcaPolicyDraft; set: Set }) {
  return (
    <>
      <NumberField id="rca-duration" label="Long unplanned stop (minutes)" hint="An unplanned stop at least this long triggers; 0 switches it off." value={draft.durationMinutes} onChange={(v) => set('durationMinutes', v)} />
      <NumberField id="rca-quantity" label="Lost quantity (% of the unit's daily plan)" hint="Approved lost quantity of one stop at or above this share triggers; empty = off." value={draft.lostQuantityPercent} onChange={(v) => set('lostQuantityPercent', v)} />
      <NumberField id="rca-repeat-count" label="Repeated incidents" hint="This many incidents…" value={draft.repeatCount} onChange={(v) => set('repeatCount', v)} />
      <NumberField id="rca-repeat-days" label="…within (days)" hint="…inside this many days trigger." value={draft.repeatWindowDays} onChange={(v) => set('repeatWindowDays', v)} />
      <Choice id="rca-repeat-match" label="Counted as the same problem when they share" value={draft.repeatMatch} options={Object.entries(REPEAT_MATCH_LABELS) as Array<[RcaPolicyDraft['repeatMatch'], string]>} onChange={(v) => set('repeatMatch', v)} />
      <NumberField id="rca-cumulative-hours" label="Bad actor: same-mode downtime (hours)" hint="Summed small stops of one asset and mode; empty = off." value={draft.cumulativeHours} onChange={(v) => set('cumulativeHours', v)} />
      <NumberField id="rca-cumulative-days" label="…within (days)" hint="Rolling window of the bad-actor sum." value={draft.cumulativeDays} onChange={(v) => set('cumulativeDays', v)} />
    </>
  );
}

/** Critical assets and the money limit (finance sets the amount with its currency). */
function OverrideFields({ draft, set }: { draft: RcaPolicyDraft; set: Set }) {
  return (
    <>
      <NumberField id="rca-critical" label="Critical asset criticalities" hint="Comma-separated asset criticality values, e.g. Critical." value={draft.criticalities} onChange={(v) => set('criticalities', v)} />
      <NumberField id="rca-critical-factor" label="Thresholds of critical assets ×" hint="0.5 halves the duration, quantity and bad-actor thresholds." value={draft.criticalFactor} onChange={(v) => set('criticalFactor', v)} />
      <NumberField id="rca-cost" label="Money limit (approved value, optional)" hint="Empty = no cost trigger; finance sets the amount." value={draft.costThreshold} onChange={(v) => set('costThreshold', v)} />
      <Choice id="rca-cost-currency" label="Money limit currency" value={draft.costCurrency} options={[['', 'Choose…'], ['USD', 'USD'], ['IRR', 'IRR']]} onChange={(v) => set('costCurrency', v)} />
    </>
  );
}

/** A new version of the RCA trigger policy, prefilled from the version in force; applies from now. */
export function RcaPolicyForm({ current, unitId }: { current: RcaPolicyVersion; unitId: string | null }) {
  const create = useCreateRcaPolicy();
  const [draft, setDraft] = useState<RcaPolicyDraft>(() => draftOf(current));
  const [rules, setRules] = useState<RcaRulesDraft>(() => rulesDraftOf(current));
  const [saved, setSaved] = useState(false);
  const set: Set = (key, value) => {
    setSaved(false);
    setDraft((old) => ({ ...old, [key]: value }));
  };
  const setRule = <K extends keyof RcaRulesDraft>(key: K, value: RcaRulesDraft[K]) => {
    setSaved(false);
    setRules((old) => ({ ...old, [key]: value }));
  };
  const triggers = inputOf(draft, unitId);
  const ruleInput = rulesInputOf(rules, current);
  const input = triggers && ruleInput ? { ...triggers, ...ruleInput } : null;
  const submit = async () => {
    if (!input) return;
    setSaved(await create.submit(input).then(() => true, () => false));
  };
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="rca-policy-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <ProductionFields draft={draft} set={set} />
        <OverrideFields draft={draft} set={set} />
        <Choice id="rca-auto" label="When a trigger fires" value={draft.autoCreate} options={[['recommend', 'Recommend an RCA on the event'], ['create', 'Open an investigation automatically']]} onChange={(v) => set('autoCreate', v)} />
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rca-notes">Why this change (optional)</Label>
          <Textarea id="rca-notes" maxLength={2000} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <RcaPolicyRulesFields draft={rules} set={setRule} />
      {create.error ? <RcaErrorAlert error={create.error} /> : null}
      {saved && <p role="status" className="text-sm">Saved: the new version applies from now.</p>}
      <Button type="submit" disabled={!input || create.isPending}>{create.isPending ? 'Saving…' : 'Save as new version'}</Button>
    </form>
  );
}
