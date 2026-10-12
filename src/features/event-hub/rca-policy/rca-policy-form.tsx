import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useCreateRcaPolicy, type RcaPolicyInput, type RcaPolicyVersion } from './rca-policy-api';

interface Draft {
  durationMinutes: string;
  repeatCount: string;
  repeatWindowDays: string;
  autoCreate: 'recommend' | 'create';
  costThreshold: string;
  notes: string;
}

const draftOf = (policy: RcaPolicyVersion): Draft => ({
  durationMinutes: String(Math.round(policy.durationThresholdSeconds / 60)),
  repeatCount: String(policy.repeatCount),
  repeatWindowDays: String(policy.repeatWindowDays),
  autoCreate: policy.autoCreate,
  costThreshold: policy.costThreshold === null ? '' : String(policy.costThreshold),
  notes: '',
});

const wholeNumber = (text: string, min: number) => (/^\d+$/.test(text.trim()) && Number(text) >= min ? Number(text) : null);

/** The request of a draft, or null while a number is missing or out of range (the server re-validates). */
function inputOf(draft: Draft, unitId: string | null): RcaPolicyInput | null {
  const minutes = wholeNumber(draft.durationMinutes, 0);
  const repeatCount = wholeNumber(draft.repeatCount, 1);
  const repeatWindowDays = wholeNumber(draft.repeatWindowDays, 1);
  const cost = draft.costThreshold.trim() === '' ? null : Number(draft.costThreshold);
  if (minutes === null || repeatCount === null || repeatWindowDays === null || (cost !== null && !(cost >= 0))) return null;
  const notes = draft.notes.trim();
  return { unitId, durationThresholdSeconds: minutes * 60, repeatCount, repeatWindowDays, autoCreate: draft.autoCreate, costThreshold: cost, ...(notes ? { notes } : {}) };
}

function NumberField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** A new version of the RCA trigger policy, prefilled from the version in force; applies from now. */
export function RcaPolicyForm({ current, unitId }: { current: RcaPolicyVersion; unitId: string | null }) {
  const create = useCreateRcaPolicy();
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((old) => ({ ...old, [key]: value }));
  };
  const input = inputOf(draft, unitId);
  const submit = async () => {
    if (!input) return;
    const ok = await create.submit(input).then(() => true, () => false);
    setSaved(ok);
  };
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="rca-policy-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id="rca-duration" label="Long unplanned stop (minutes)" hint="An unplanned stop at least this long triggers; 0 switches it off." value={draft.durationMinutes} onChange={(v) => set('durationMinutes', v)} />
        <NumberField id="rca-cost" label="Valued loss threshold (optional)" hint="Empty = no cost trigger." value={draft.costThreshold} onChange={(v) => set('costThreshold', v)} />
        <NumberField id="rca-repeat-count" label="Repeated failures of one asset" hint="This many functional failures…" value={draft.repeatCount} onChange={(v) => set('repeatCount', v)} />
        <NumberField id="rca-repeat-days" label="…within (days)" hint="…inside this many days trigger." value={draft.repeatWindowDays} onChange={(v) => set('repeatWindowDays', v)} />
        <div className="space-y-1">
          <Label htmlFor="rca-auto">When a trigger fires</Label>
          <select id="rca-auto" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.autoCreate} onChange={(e) => set('autoCreate', e.target.value === 'create' ? 'create' : 'recommend')}>
            <option value="recommend">Recommend an RCA on the event</option>
            <option value="create">Open an RCA case automatically</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rca-notes">Why this change (optional)</Label>
          <Textarea id="rca-notes" maxLength={2000} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      {create.error ? <FriendlyErrorAlert error={create.error} /> : null}
      {saved && <p role="status" className="text-sm">Saved: the new version applies from now.</p>}
      <Button type="submit" disabled={!input || create.isPending}>{create.isPending ? 'Saving…' : 'Save as new version'}</Button>
    </form>
  );
}
