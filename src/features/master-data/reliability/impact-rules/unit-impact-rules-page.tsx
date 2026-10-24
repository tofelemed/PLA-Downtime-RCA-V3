import { Button } from '@/components/ui/button';
import { useUnitImpactRules } from '@/api/v2/queries/unit-impact-rules';
import type { UnitImpactRuleView } from '@/api/v2/types/unit-impact';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RcaCard } from '@/features/rca/components/rca-card';
import { PlantTimeRange } from '@/features/ux-kit/plant-time-range';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePlanningRefs, type PlanningRefs } from '@/features/plans-profiles-calendars/hooks/use-planning-refs';
import { VersionActions } from '@/features/plans-profiles-calendars/profiles/version-actions';
import { useUnitParam } from '@/features/plans-profiles-calendars/hooks/use-unit-param';
import { MasterDataLayout } from '../../components/master-data-layout';
import { COMPACT_FIELDS } from '../../components/compact-fields';
import { UnitSelect } from '../../components/unit-select';
import { useAssetLookup } from '../shared/use-asset-lookup';
import { ImpactRuleForm } from './impact-rule-form';
import { IMPACT_MODE_LABELS } from './impact-rule-form-model';
import { impactRuleSaveResult } from './impact-rule-save-result';
import { AddDialog, useAddDialog } from '@/features/ux-kit/add-dialog';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';

/** What the rules mean, behind the ⓘ of the Rules card. */
const RULES_INFO =
  'How a stop of one piece of equipment affects its unit: without a rule the unit stops; a standby that starts in time holds the output. Drafts apply after another manager approves them.';

/** 50 → "50 %", 12.5 → "12.5 %" in the plant's digits. */
const shareText = (value: number, percent: (v: number, digits?: number) => string) =>
  percent(value, Number.isInteger(value) ? 0 : 1);

interface ColumnInput {
  refs: PlanningRefs;
  assetLabel: (id: string | null) => string;
  percent: (fraction: string) => string;
  seconds: (value: number) => string;
}

function columnsOf({ refs, assetLabel, percent, seconds }: ColumnInput): DataTableColumn<UnitImpactRuleView>[] {
  return [
    { id: 'asset', header: 'Asset', cell: (r) => <span className="font-medium" data-testid="impact-rule-row">{assetLabel(r.assetId)}</span> },
    { id: 'unit', header: 'Unit', cell: (r) => refs.unitName(r.unitId) },
    { id: 'mode', header: 'Impact on the unit', cell: (r) => (r.mode === 'fractional' && r.fraction ? `Partial: ${percent(r.fraction)} of the rate` : IMPACT_MODE_LABELS[r.mode]) },
    { id: 'standby', header: 'Standby', cell: (r) => (r.standbyAssetId ? `${assetLabel(r.standbyAssetId)} (within ${seconds(r.takeoverSeconds)} s)` : '—') },
    { id: 'reason', header: 'Why', cell: (r) => r.reason },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (r) => (
        <PlantTimeRange className="text-xs" from={r.effectiveFrom} to={r.effectiveTo} tz={refs.timezone} withZone={false} />
      ),
    },
    { id: 'state', header: 'State', nowrap: true, cell: (r) => <VersionStateBadge state={r.state} /> },
    { id: 'actions', header: 'Actions', nowrap: true, cell: (r) => <VersionActions resource="unit-impact-rules" id={r.id} state={r.state} timezone={refs.timezone} authorId={r.createdBy} /> },
  ];
}

/**
 * `/master-data/unit-impact-rules` (plan 1.10, SME Q5 + D9): how a stop of one asset affects its unit —
 * full stop, a share of the rate, or none — and the installed standby whose start holds the output. Drafts
 * are approved by another manager; the server then re-resolves the asset's stops. A stop whose impact a
 * person stated keeps it.
 */
export function UnitImpactRulesPage() {
  const capabilities = useCapabilities();
  const { canWriteUnitImpactRules, canApproveProfiles } = capabilities;
  const refs = usePlanningRefs();
  const anchor = useAnchorFocus('unit-impact-rule-');
  const [unitId, setUnitId] = useUnitParam();
  const rules = useUnitImpactRules({ unitId, focus: anchor.focus });
  useSeekAnchor(anchor, infiniteListState(rules.query));
  const { labelOf } = useAssetLookup();
  const { percent, number } = useNumberFormat();
  const add = useAddDialog();
  // "Add another" reopens the dialog (`useAddDialog().saved`) with an empty form
  const resultOf = (rule: UnitImpactRuleView) =>
    impactRuleSaveResult({ rule, recordLabel: `${labelOf(rule.assetId)} on ${refs.unitName(rule.unitId)}`, onAddAnother: () => undefined, capabilities });
  return (
    <MasterDataLayout
      title="Unit impact rules"
      alsoAllowed={canWriteUnitImpactRules || canApproveProfiles}
      actions={
        canWriteUnitImpactRules && (
          <Button onClick={add.open} data-testid="impact-rule-new">
            <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
            Add rule
          </Button>
        )
      }
    >
      <div className={`w-72 ${COMPACT_FIELDS}`} data-testid="impact-rules-filters">
        <UnitSelect id="impact-rules-unit" label="Unit" value={unitId} onChange={setUnitId} allowAll />
      </div>
      <RcaCard title="Rules" info={RULES_INFO} testId="impact-rules-card">
        <FocusedListNotice anchor={anchor} what="rules" />
        <DataTable
          caption="Unit impact rules"
          columns={columnsOf({ refs, assetLabel: labelOf, percent: (f) => shareText(Number(f) * 100, percent), seconds: (v) => number(v) })}
          rows={rules.rows}
          getRowKey={(r) => r.id}
          getRowAnchor={(r) => `unit-impact-rule-${r.id}`}
          scrollable
          pager={rules.pager}
          status={rules.status}
          empty={{
            title: 'No rules',
            text: unitId
              ? 'Every equipment stop of this unit stops it unless a person records another impact on the stop.'
              : 'Every equipment stop stops its unit unless a person records another impact on the stop.',
          }}
        />
      </RcaCard>
      <AddDialog
        open={add.isOpen}
        onOpenChange={add.setOpen}
        title="Add unit impact rule"
        titleAside={<KpiInfo label="new impact rules" text="A draft applies after another manager approves it." />}
        wide
        testId="impact-rule-dialog"
      >
        <ImpactRuleForm initialUnitId={unitId} unitOptions={refs.unitOptions} timezone={refs.timezone} resultOf={resultOf} onSaved={add.saved} onCancel={add.close} />
      </AddDialog>
      {add.resultElement}
    </MasterDataLayout>
  );
}
