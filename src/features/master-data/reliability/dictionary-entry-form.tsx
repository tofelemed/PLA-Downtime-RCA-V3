import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDictionaryEntry } from '@/api/v2/queries/failure-dictionary';
import { DICTIONARY_KIND_LABELS, type DictionaryKind } from '@/api/v2/types/failure-dictionary';
import { friendlyToastContent } from '@/features/ux-kit/errors';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const KINDS = Object.keys(DICTIONARY_KIND_LABELS) as DictionaryKind[];
const CLASS_BOUND = new Set<DictionaryKind>(['maintainable_item', 'failure_mode']);

interface Draft {
  kind: DictionaryKind;
  equipmentClass: string;
  code: string;
  name: string;
  assetTypes: string;
  isPending: boolean;
}

const EMPTY: Draft = { kind: 'equipment_class', equipmentClass: '', code: '', name: '', assetTypes: '', isPending: false };

/** Adds one entry; the server checks the class and refuses a code already in force (409). */
export function DictionaryEntryForm({ classes }: { classes: readonly string[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const command = useCreateDictionaryEntry();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const submit = async () => {
    setMessage(null);
    try {
      await command.submit({
        kind: draft.kind,
        code: draft.code.trim(),
        name: draft.name.trim(),
        ...(CLASS_BOUND.has(draft.kind) && draft.equipmentClass ? { equipmentClass: draft.equipmentClass } : {}),
        ...(draft.kind === 'equipment_class' ? { assetTypes: draft.assetTypes.split(';').map((t) => t.trim()).filter(Boolean) } : {}),
        isPending: draft.isPending,
      });
      setDraft({ ...EMPTY, kind: draft.kind, equipmentClass: draft.equipmentClass });
      setMessage('Entry added.');
    } catch (error: unknown) {
      setMessage(friendlyToastContent(error).description);
    }
  };
  return (
    <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="dictionary-entry-form">
      <div className="space-y-1">
        <Label htmlFor="entry-kind">List</Label>
        <select id="entry-kind" className={SELECT_CLASS} value={draft.kind} onChange={(e) => set('kind', e.target.value as DictionaryKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{DICTIONARY_KIND_LABELS[k]}</option>)}
        </select>
      </div>
      {CLASS_BOUND.has(draft.kind) && (
        <div className="space-y-1">
          <Label htmlFor="entry-class">Equipment class</Label>
          <select id="entry-class" className={SELECT_CLASS} value={draft.equipmentClass} onChange={(e) => set('equipmentClass', e.target.value)}>
            <option value="">Every class</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {draft.kind === 'equipment_class' && (
        <div className="space-y-1">
          <Label htmlFor="entry-asset-types">Asset types (separated by ;)</Label>
          <Input id="entry-asset-types" value={draft.assetTypes} onChange={(e) => set('assetTypes', e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="entry-code">Code</Label>
        <Input id="entry-code" value={draft.code} maxLength={50} onChange={(e) => set('code', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="entry-name">Name</Label>
        <Input id="entry-name" value={draft.name} maxLength={255} onChange={(e) => set('name', e.target.value)} />
      </div>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" checked={draft.isPending} onChange={(e) => set('isPending', e.target.checked)} />
        Pending / unknown choice
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <Button type="submit" disabled={!draft.code.trim() || !draft.name.trim() || command.isPending}>Add entry</Button>
        {message && <p className="text-sm" role="status">{message}</p>}
      </div>
    </form>
  );
}
