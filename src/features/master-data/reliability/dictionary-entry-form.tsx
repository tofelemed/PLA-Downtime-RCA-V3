import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDictionaryEntry } from '@/api/v2/queries/failure-dictionary';
import { DICTIONARY_KIND_LABELS, type DictionaryKind } from '@/api/v2/types/failure-dictionary';
import { useSaveFeedback } from '@/features/ux-kit/save-result';

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

export interface DictionaryEntryFormProps {
  classes: readonly string[];
  /** in the header's "Add entry" dialog: "Add entry" closes it, "Save and add another" keeps it open for the next one */
  onAdded?: () => void;
}

/**
 * Adds one entry; the server checks the class and refuses a code already in force (409). Success: a toast
 * and empty code / name fields (list and class stay for the next entry), then `onAdded` unless the user
 * chose "Save and add another"; a refusal: the red alert on top, the input kept.
 */
export function DictionaryEntryForm({ classes, onAdded }: DictionaryEntryFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const command = useCreateDictionaryEntry();
  const feedback = useSaveFeedback();
  const ready = Boolean(draft.code.trim() && draft.name.trim()) && !command.isPending;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const submit = async (another = false) => {
    try {
      await feedback.run(() => command.submit({
        kind: draft.kind,
        code: draft.code.trim(),
        name: draft.name.trim(),
        ...(CLASS_BOUND.has(draft.kind) && draft.equipmentClass ? { equipmentClass: draft.equipmentClass } : {}),
        ...(draft.kind === 'equipment_class' ? { assetTypes: draft.assetTypes.split(';').map((t) => t.trim()).filter(Boolean) } : {}),
        isPending: draft.isPending,
      }), 'Entry added');
      setDraft({ ...EMPTY, kind: draft.kind, equipmentClass: draft.equipmentClass });
      if (!another) onAdded?.();
    } catch {
      // the alert above the fields explains the refusal; the input stays for a correction
    }
  };
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-testid="dictionary-entry-form">
      <div className="sm:col-span-2 empty:hidden">{feedback.alert}</div>
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
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={draft.isPending} onChange={(e) => set('isPending', e.target.checked)} />
        Pending / unknown choice
      </label>
      <div className="flex items-end justify-end gap-2 sm:col-span-2">
        {onAdded && <Button type="button" variant="outline" disabled={!ready} onClick={() => void submit(true)}>Save and add another</Button>}
        <Button type="submit" disabled={!ready}>Add entry</Button>
      </div>
    </form>
  );
}
