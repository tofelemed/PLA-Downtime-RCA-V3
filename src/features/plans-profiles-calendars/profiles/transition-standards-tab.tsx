import { Label } from '@/components/ui/label';
import { useTransitionStandards } from '@/api/v2/queries/profiles';
import type { TransitionStandardView } from '@/api/v2/types/profiles';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ChooseUnitEmpty } from '../components/choose-unit-empty';
import { NativeSelect } from '../components/native-select';
import { TableCard } from '../components/table-card';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { VersionActions } from './version-actions';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';
import { useUnitParam } from '../hooks/use-unit-param';
import { operatingModeLabel } from '../model/plan-labels';

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
    { id: 'catalyst', header: 'Catalyst family', nowrap: true, cell: (s) => s.catalystFamily ?? <span className="text-muted-foreground">any</span> },
    { id: 'mode', header: 'Operating mode', nowrap: true, cell: (s) => s.operatingMode ? operatingModeLabel(s.operatingMode) : <span className="text-muted-foreground">any</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (s) => `Version ${s.version}` },
    { id: 'reference', header: 'Reference', align: 'right', nowrap: true, cell: (s) => <DurationText seconds={s.referenceSeconds} /> },
    {
      id: 'offgrade',
      header: 'Reference off-grade',
      align: 'right',
      nowrap: true,
      cell: (s) => (s.referenceOffgradeQty ? <Quantity value={s.referenceOffgradeQty} uom={s.offgradeUom ?? ''} /> : 'time share'),
    },
    { id: 'evidence', header: 'Evidence', cell: (s) => <span className="text-xs">{s.sampleCount ? <LocalizedNumber text={`${s.sampleCount} transitions · `} /> : ''}{s.evidence ?? '—'}</span> },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (s) => (
        <span className="text-xs">
          <PlantTime iso={s.effectiveFrom} tz={refs.timezone} withDate withZone={false} /> → {s.effectiveTo ? <PlantTime iso={s.effectiveTo} tz={refs.timezone} withDate withZone={false} /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', nowrap: true, cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', nowrap: true, cell: (s) => <VersionActions resource="transition-standards" id={s.id} state={s.state} timezone={refs.timezone} authorId={s.createdBy} /> },
  ];
}

const MATRIX_INFO =
  'Approved reference durations per product change, catalyst family and operating mode (blank = any; the most specific entry applies). Transition loss within the reference is an allowance, the rest an overrun.';

/**
 * The grade-transition matrix of a unit (LA-08): approved reference durations per directional product
 * change, catalyst family and operating mode (SME E1; blank = any, the most specific entry applies). Transition loss within the reference is an allowance, the rest an overrun; a change with no
 * approved entry is all loss, flagged — the matrix is never filled with a default. "Add transition standard" is
 * beside the page title (`AddTransitionStandard`).
 */
export function TransitionStandardsTab() {
  const refs = usePlanningRefs();
  // a deep link names the unit of the linked row (`?unitId=…#…`); the choice stays in the URL
  const [unitId, setUnitId] = useUnitParam();
  const anchor = useAnchorFocus('transition-standard-');
  const standards = useTransitionStandards(unitId, anchor.focus);
  useSeekAnchor(anchor, infiniteListState(standards.query));
  return (
    <div className="space-y-4" data-testid="transition-standards-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className={`${FIELD_CLASS} w-64`}>
          <Label htmlFor="transitionUnit">Unit</Label>
          <NativeSelect id="transitionUnit" value={unitId} options={refs.unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
        </div>
      </div>
      <FocusedListNotice anchor={anchor} what="transition standards" />
      {unitId ? (
        <TableCard title="Grade-transition standards" info={MATRIX_INFO}>
          <DataTable
            caption="Grade-transition standards"
            columns={columnsOf(refs)}
            rows={standards.rows}
            getRowKey={(s) => s.id}
            getRowAnchor={(s) => `transition-standard-${s.id}`}
            pager={standards.pager}
            status={standards.status}
            empty={{ title: 'No transition standards', text: 'No transition standards: every grade change of this unit counts as loss, flagged “no transition standard”.' }}
          />
        </TableCard>
      ) : (
        <ChooseUnitEmpty what="grade-transition matrix" />
      )}
    </div>
  );
}
