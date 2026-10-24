import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDictionaryClasses, useFailureDictionaryPage, useRetireDictionaryEntry } from '@/api/v2/queries/failure-dictionary';
import { DICTIONARY_KIND_LABELS, type FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AddDialog, useAddDialog } from '@/features/ux-kit/add-dialog';
import { RcaCard } from '@/features/rca/components/rca-card';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { ActionIcon } from '@/lib/icons';
import { MasterDataLayout } from '../components/master-data-layout';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { DictionaryEntryForm } from './dictionary-entry-form';
import { dictionaryEntryName } from './dictionary-entry-name';
import { DictionaryFilters } from './dictionary-filters';
import { useDictionaryFilters } from './use-dictionary-filters';

/** What the dictionary is, behind the ⓘ of its card. */
const DICTIONARY_INFO = "Failure codes (ISO 14224) that maintenance uses to describe a stop's technical failure. A retired entry is no longer offered; recorded stops keep it.";

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
      ? [{ id: 'actions', header: '', headerLabel: 'Actions', align: 'right' as const, cell: (e: FailureDictionaryEntryView) => <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => onRetire(e)}>Retire</Button> }]
      : []),
  ];
}

/**
 * "Retire <code>?": a retired entry is no longer offered on new stops; recorded stops keep it. Success → toast;
 * a refusal → the red alert inside the still-open dialog (DECISIONS 2026-10-22 "Save feedback").
 */
function RetireEntryDialog({ entry, onClose }: { entry: FailureDictionaryEntryView | null; onClose: () => void }) {
  const retire = useRetireDictionaryEntry();
  const feedback = useSaveFeedback();
  const close = () => {
    feedback.clearFailure();
    onClose();
  };
  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(open) => !open && close()}
      title={entry ? `Retire ${entry.code} — ${entry.name}?` : 'Retire entry?'}
      description="It is no longer offered when describing a stop's failure. Stops that already use it keep it."
      confirmLabel="Retire entry"
      destructive
      onConfirm={() => (entry ? feedback.run(() => retire.submit(entry.id), `${entry.code} retired`) : undefined)}
    >
      {feedback.alert}
    </ConfirmDialog>
  );
}

/** Header actions (SETUP_UX_FIXES Phase 4): Import CSV opens the import sub-page, Add entry a dialog. */
function HeaderActions({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <Button asChild variant="outline" data-testid="dictionary-import-open">
        <Link to="/master-data/failure-dictionary/import"><ActionIcon.import aria-hidden="true" />Import CSV</Link>
      </Button>
      <Button onClick={onAdd} data-testid="dictionary-entry-new"><ActionIcon.add aria-hidden="true" />Add entry</Button>
    </>
  );
}

/**
 * `/master-data/failure-dictionary`: the plant's ISO 14224-aligned failure dictionary (SME D11) — equipment
 * classes, their maintainable items and failure modes, and the mechanism, cause and detection lists. Event
 * failure fields pick from it; without entries they stay free text.
 */
export function FailureDictionaryPage() {
  const filterState = useDictionaryFilters();
  const { filters } = filterState;
  const entries = useFailureDictionaryPage(filters);
  const classes = useDictionaryClasses();
  const filtered = Boolean(filters.q || filters.kind || filters.equipmentClass);
  const canWrite = useMasterDataWriter();
  // QA re-test N9: reliability engineers read the dictionary (they validate failure detail); writes stay master data
  const { canValidateFailures } = useCapabilities();
  const dates = usePlantDates();
  const [retiring, setRetiring] = useState<FailureDictionaryEntryView | null>(null);
  const adding = useAddDialog();
  return (
    <MasterDataLayout
      title="Failure dictionary"
      alsoAllowed={canValidateFailures}
      actions={canWrite ? <HeaderActions onAdd={adding.open} /> : undefined}
    >
      <DictionaryFilters state={filterState} classes={classes} />
      <RcaCard title="Entries in force" info={DICTIONARY_INFO} testId="dictionary-card">
        <DataTable
          caption="Failure dictionary entries"
          columns={columnsOf(canWrite, setRetiring, dates.date)}
          rows={entries.rows}
          getRowKey={(e) => e.id}
          pager={entries.pager}
          status={entries.status}
          empty={
            filtered
              ? { title: 'No matching entries', text: 'No entry in force matches the search and filters.' }
              : { title: 'No dictionary yet', text: 'No entries yet. Failure fields stay free text until the plant imports its codes.' }
          }
        />
      </RcaCard>
      <RetireEntryDialog entry={retiring} onClose={() => setRetiring(null)} />
      <AddDialog
        open={adding.isOpen}
        onOpenChange={adding.setOpen}
        title="Add dictionary entry"
        wide
        testId="dictionary-entry-dialog"
      >
        <DictionaryEntryForm classes={classes} onAdded={adding.close} onCancel={adding.close} />
      </AddDialog>
    </MasterDataLayout>
  );
}
