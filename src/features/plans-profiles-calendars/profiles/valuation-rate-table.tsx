import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useValuationRates } from '@/api/v2/queries/profiles';
import type { ProfileView, ValuationRateView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, VALUATION_BASIS_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { FormDialog } from '../components/form-dialog';
import { SETUP_LOOK } from '../model/setup-look';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { ValuationRateForm } from './valuation-rate-form';
import { VersionActions } from './version-actions';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';

export interface ValuationRateTableProps {
  profile: ProfileView;
  timezone: string;
}

/** The old product cost kept on a seeded profile: shown for review, never used until finance confirms it. */
function LegacyCost({ profile }: { profile: ProfileView }) {
  const { text } = useNumberFormat();
  const legacy = profile.legacy?.standardRate;
  if (legacy === undefined || legacy === null) return null;
  return (
    <p className="text-sm" data-testid="legacy-cost">
      <Badge variant="outline" className="mr-2 border-warning/40 bg-warning/10 text-warning">
        Unconfirmed earlier cost
      </Badge>
      Standard rate {text(legacy)} (no currency) from the old master data — not used for valuation until finance confirms it.
    </p>
  );
}

/** The Actions column only for those who can act (approve / retire): otherwise it would stay empty. */
function columnsOf(timezone: string, withActions: boolean): DataTableColumn<ValuationRateView>[] {
  const columns: DataTableColumn<ValuationRateView>[] = [
    { id: 'basis', header: 'Basis', cell: (r) => <span data-testid="valuation-row">{labelOf(VALUATION_BASIS_LABELS, r.basis)}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (r) => `Version ${r.version}` },
    { id: 'value', header: 'Value', align: 'right', nowrap: true, cell: (r) => <Quantity value={r.value} uom={r.currency ? `${r.currency}/${r.perUom}` : `per ${r.perUom}`} /> },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (r) => (
        <span className="text-xs">
          <PlantTime iso={r.effectiveFrom} tz={timezone} withDate withZone={false} /> → {r.effectiveTo ? <PlantTime iso={r.effectiveTo} tz={timezone} withDate withZone={false} /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (r) => <VersionStateBadge state={r.state} /> },
  ];
  if (!withActions) return columns;
  return [...columns, { id: 'actions', header: 'Actions', cell: (r) => <VersionActions resource="valuation-rates" id={r.id} state={r.state} timezone={timezone} authorId={r.createdBy} /> }];
}

/** Margin / standard-cost versions of the profile: basis, value, currency, validity and approval (20 per page). */
export function ValuationRateTable({ profile, timezone }: ValuationRateTableProps) {
  const { canMaintainValuation, canApproveValuation } = useCapabilities();
  const anchor = useAnchorFocus('valuation-rate-');
  const rates = useValuationRates(profile.id, anchor.focus);
  const [adding, setAdding] = useState(false);
  const items = flattenPages(rates.data?.pages);
  useSeekAnchor(anchor, infiniteListState(rates));
  const add = canMaintainValuation && (
    <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setAdding(true)} data-testid="valuation-rate-add">
      <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
      Add valuation rate
    </Button>
  );
  return (
    <ReportLookContext.Provider value={SETUP_LOOK}>
      <Section title="Valuation rates" actions={add || undefined} className="rounded-lg border bg-card p-4">
        <div className="space-y-3" data-testid="valuation-rate-table">
          <LegacyCost profile={profile} />
          <FocusedListNotice anchor={anchor} what="valuation rates" />
          <FormDialog open={adding} onOpenChange={setAdding} title="Add valuation rate" info="A draft margin or standard-cost version of this profile; another person approves it." testId="valuation-rate-dialog">
            <ValuationRateForm profileId={profile.id} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />
          </FormDialog>
          <DataTable
            caption="Valuation rate versions"
            columns={columnsOf(timezone, canApproveValuation)}
            rows={items}
            getRowKey={(r) => r.id}
            getRowAnchor={(r) => `valuation-rate-${r.id}`}
            status={{ isLoading: rates.isLoading, isError: rates.isError, error: rates.error, onRetry: () => void rates.refetch() }}
            empty={{ title: 'No valuation rates', text: 'No valuation rates: losses of this profile stay unvalued.' }}
          />
          {rates.hasNextPage && (
            <Button size="sm" variant="ghost" onClick={() => void rates.fetchNextPage()} disabled={rates.isFetchingNextPage}>
              Load older valuation rates
            </Button>
          )}
        </div>
      </Section>
    </ReportLookContext.Provider>
  );
}
