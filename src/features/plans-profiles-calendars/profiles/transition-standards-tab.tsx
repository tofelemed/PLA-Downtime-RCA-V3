import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTransitionStandards } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { TransitionStandardView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { VersionStateBadge } from '../components/version-state-badge';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { hoursOfSeconds } from '../model/transition-standard-form';
import { TransitionStandardForm } from './transition-standard-form';
import { VersionActions } from './version-actions';

function columnsOf(refs: PlanningRefs): DataTableColumn<TransitionStandardView>[] {
  return [
    {
      id: 'change',
      header: 'Grade change',
      cell: (s) => (
        <span className="font-medium" data-testid="transition-standard-row">
          {refs.productName(s.fromProductId)} → {refs.productName(s.toProductId)}
        </span>
      ),
    },
    { id: 'version', header: 'Version', nowrap: true, cell: (s) => `Version ${s.version}` },
    { id: 'reference', header: 'Reference', align: 'right', nowrap: true, cell: (s) => `${hoursOfSeconds(s.referenceSeconds)} h` },
    {
      id: 'offgrade',
      header: 'Reference off-grade',
      align: 'right',
      nowrap: true,
      cell: (s) => (s.referenceOffgradeQty ? <Quantity value={s.referenceOffgradeQty} uom={s.offgradeUom ?? ''} /> : 'time share'),
    },
    { id: 'evidence', header: 'Evidence', cell: (s) => <span className="text-xs">{s.sampleCount ? `${s.sampleCount} transitions · ` : ''}{s.evidence ?? '—'}</span> },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (s) => (
        <span className="text-xs">
          <PlantTime iso={s.effectiveFrom} tz={refs.timezone} withDate /> → {s.effectiveTo ? <PlantTime iso={s.effectiveTo} tz={refs.timezone} withDate /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', cell: (s) => <VersionActions resource="transition-standards" id={s.id} state={s.state} timezone={refs.timezone} authorId={s.createdBy} /> },
  ];
}

/**
 * The grade-transition matrix of a unit (LA-08): approved reference durations per directional product
 * change. Transition loss within the reference is an allowance, the rest an overrun; a change with no
 * approved entry is all loss, flagged — the matrix is never filled with a default.
 */
export function TransitionStandardsTab() {
  const { canWriteProfiles } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId, setUnitId] = useState('');
  const [adding, setAdding] = useState(false);
  const standards = useTransitionStandards(unitId);
  const rows = flattenPages(standards.data?.pages);
  return (
    <div className="space-y-4" data-testid="transition-standards-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <FormField id="transitionUnit" label="Unit">
            <NativeSelect id="transitionUnit" value={unitId} options={refs.unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
          </FormField>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReadOnlyHint />
          {canWriteProfiles && unitId && !adding && (
            <Button size="sm" onClick={() => setAdding(true)} data-testid="transition-standard-new">
              <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
              Add transition standard
            </Button>
          )}
        </div>
      </div>
      {adding && unitId && <TransitionStandardForm unitId={unitId} productOptions={refs.productOptions} timezone={refs.timezone} onDone={() => setAdding(false)} />}
      {unitId ? (
        <DataTable
          caption="Grade-transition standards"
          columns={columnsOf(refs)}
          rows={rows}
          getRowKey={(s) => s.id}
          status={{ isLoading: standards.isLoading, isError: standards.isError, error: standards.error, onRetry: () => void standards.refetch() }}
          empty={{ title: 'No transition standards', text: 'Every grade change of this unit counts as loss, flagged “no transition standard”.' }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Choose a unit to see its grade-transition matrix.</p>
      )}
      {standards.hasNextPage && (
        <Button size="sm" variant="ghost" onClick={() => void standards.fetchNextPage()} disabled={standards.isFetchingNextPage}>
          Load more standards
        </Button>
      )}
    </div>
  );
}
