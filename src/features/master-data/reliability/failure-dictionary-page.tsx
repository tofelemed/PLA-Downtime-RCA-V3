import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFailureDictionary, useRetireDictionaryEntry } from '@/api/v2/queries/failure-dictionary';
import { DICTIONARY_KIND_LABELS, type DictionaryKind, type FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { useToast } from '@/hooks/use-toast';
import { MasterDataLayout } from '../components/master-data-layout';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { DictionaryEntryForm } from './dictionary-entry-form';
import { dictionaryEntryName } from './dictionary-entry-name';
import { DictionaryImportPanel } from './dictionary-import-panel';

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const KINDS = Object.keys(DICTIONARY_KIND_LABELS) as DictionaryKind[];

type DateText = (iso: string | null | undefined) => string;

function columnsOf(canWrite: boolean, onRetire: (entry: FailureDictionaryEntryView) => void, date: DateText): DataTableColumn<FailureDictionaryEntryView>[] {
  return [
    { id: 'kind', header: 'List', cell: (e) => DICTIONARY_KIND_LABELS[e.kind], nowrap: true },
    { id: 'class', header: 'Equipment class', cell: (e) => (e.kind === 'equipment_class' ? '—' : e.equipmentClass || 'Every class') },
    { id: 'code', header: 'Code', cell: (e) => e.code, nowrap: true },
    { id: 'name', header: 'Name', cell: dictionaryEntryName },
    { id: 'detail', header: 'Asset types / category', cell: (e) => (e.assetTypes.length ? e.assetTypes.join(', ') : (e.category ?? '—')) },
    { id: 'from', header: 'In force since', cell: (e) => date(e.effectiveFrom), nowrap: true },
    ...(canWrite
      ? [{ id: 'actions', header: '', headerLabel: 'Actions', align: 'right' as const, cell: (e: FailureDictionaryEntryView) => <Button size="sm" variant="ghost" onClick={() => onRetire(e)}>Retire</Button> }]
      : []),
  ];
}

/** "Retire <code>?": a retired entry is no longer offered on new stops; recorded stops keep it. */
function RetireEntryDialog({ entry, onClose }: { entry: FailureDictionaryEntryView | null; onClose: () => void }) {
  const retire = useRetireDictionaryEntry();
  const { toast } = useToast();
  const run = async (target: FailureDictionaryEntryView) => {
    try {
      await retire.submit(target.id);
      toast({ title: `${target.code} retired` });
    } catch (failure) {
      toast({ ...friendlyToastContent(failure), variant: 'destructive' });
      throw failure;
    }
  };
  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(open) => !open && onClose()}
      title={entry ? `Retire ${entry.code} — ${entry.name}?` : 'Retire entry?'}
      description="It is no longer offered when describing a stop's failure. Stops that already use it keep it."
      confirmLabel="Retire entry"
      destructive
      onConfirm={() => (entry ? run(entry) : undefined)}
    />
  );
}

/**
 * `/master-data/failure-dictionary`: the plant's ISO 14224-aligned failure dictionary (SME D11) — equipment
 * classes, their maintainable items and failure modes, and the mechanism, cause and detection lists. Event
 * failure fields pick from it; without entries they stay free text.
 */
export function FailureDictionaryPage() {
  const { entries, isLoading, error } = useFailureDictionary();
  const [kind, setKind] = useState<DictionaryKind | ''>('');
  const canWrite = useMasterDataWriter();
  const dates = usePlantDates();
  const [retiring, setRetiring] = useState<FailureDictionaryEntryView | null>(null);
  const rows = useMemo(() => entries.filter((e) => !kind || e.kind === kind), [entries, kind]);
  const classes = useMemo(() => entries.filter((e) => e.kind === 'equipment_class').map((e) => e.code), [entries]);
  return (
    <MasterDataLayout title="Failure dictionary" description="ISO 14224-aligned failure codes that maintenance uses to describe a stop's technical failure.">
      <Section title="Entries in force">
        <label className="flex items-center gap-2 text-sm">
          List
          <select aria-label="List" className={SELECT_CLASS} value={kind} onChange={(e) => setKind(e.target.value as DictionaryKind | '')}>
            <option value="">All lists</option>
            {KINDS.map((k) => <option key={k} value={k}>{DICTIONARY_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <DataTable
          caption="Failure dictionary entries"
          columns={columnsOf(canWrite, setRetiring, dates.date)}
          rows={rows}
          getRowKey={(e) => e.id}
          status={{ isLoading, isError: Boolean(error), error }}
          empty={{ title: 'No dictionary yet', text: 'Failure fields stay free text until the plant imports its codes.' }}
        />
      </Section>
      <RetireEntryDialog entry={retiring} onClose={() => setRetiring(null)} />
      {canWrite && (
        <>
          <Section title="Add an entry"><DictionaryEntryForm classes={classes} /></Section>
          <Section title="Import (CSV)"><DictionaryImportPanel /></Section>
        </>
      )}
    </MasterDataLayout>
  );
}
