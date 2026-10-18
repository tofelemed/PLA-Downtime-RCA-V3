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
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { ValuationRateForm } from './valuation-rate-form';
import { VersionActions } from './version-actions';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

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

function columnsOf(timezone: string): DataTableColumn<ValuationRateView>[] {
  return [
    { id: 'basis', header: 'Basis', cell: (r) => <span data-testid="valuation-row">{labelOf(VALUATION_BASIS_LABELS, r.basis)}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (r) => `Version ${r.version}` },
    { id: 'value', header: 'Value', align: 'right', nowrap: true, cell: (r) => <Quantity value={r.value} uom={r.currency ? `${r.currency}/${r.perUom}` : `${r.perUom}/${r.perUom}`} /> },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (r) => (
        <span className="text-xs">
          <PlantTime iso={r.effectiveFrom} tz={timezone} withDate /> → {r.effectiveTo ? <PlantTime iso={r.effectiveTo} tz={timezone} withDate /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (r) => <VersionStateBadge state={r.state} /> },
    { id: 'actions', header: 'Actions', cell: (r) => <VersionActions resource="valuation-rates" id={r.id} state={r.state} timezone={timezone} authorId={r.createdBy} /> },
  ];
}

/** Margin / standard-cost versions of the profile: basis, value, currency, validity and approval (20 per page). */
export function ValuationRateTable({ profile, timezone }: ValuationRateTableProps) {
  const { canMaintainValuation } = useCapabilities();
  const rates = useValuationRates(profile.id);
  const [adding, setAdding] = useState(false);
  const items = flattenPages(rates.data?.pages);
  const add = !adding && canMaintainValuation && (
    <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
      <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
      Add valuation rate
    </Button>
  );
  return (
    <Section title="Valuation rates" actions={add || undefined}>
      <div className="space-y-3" data-testid="valuation-rate-table">
        <LegacyCost profile={profile} />
        {adding && <ValuationRateForm profileId={profile.id} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />}
        <DataTable
          caption="Valuation rate versions"
          columns={columnsOf(timezone)}
          rows={items}
          getRowKey={(r) => r.id}
          status={{ isLoading: rates.isLoading, isError: rates.isError, error: rates.error, onRetry: () => void rates.refetch() }}
          empty={{ text: 'No valuation rates: losses of this profile stay unvalued.' }}
        />
        {rates.hasNextPage && (
          <Button size="sm" variant="ghost" onClick={() => void rates.fetchNextPage()} disabled={rates.isFetchingNextPage}>
            Load older valuation rates
          </Button>
        )}
      </div>
    </Section>
  );
}
