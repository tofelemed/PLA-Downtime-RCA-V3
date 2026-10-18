import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useProfileRates } from '@/api/v2/queries/profiles';
import { RATE_KINDS, type ProfileView, type RateView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, RATE_KIND_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { RateForm } from './rate-form';
import { VersionActions } from './version-actions';

export interface RateTableProps {
  profile: ProfileView;
  timezone: string;
}

/** Rows in kind order (nameplate … forecast are separate values), versions in order within a kind. */
function byKind(rates: readonly RateView[]): RateView[] {
  const order = new Map<string, number>(RATE_KINDS.map((kind, index) => [kind, index]));
  return [...rates].sort((a, b) => (order.get(a.rateKind) ?? 99) - (order.get(b.rateKind) ?? 99) || a.version - b.version);
}

function columnsOf(profile: ProfileView, timezone: string): DataTableColumn<RateView>[] {
  const uom = profile.quantityUom;
  return [
    { id: 'kind', header: 'Kind', cell: (r) => labelOf(RATE_KIND_LABELS, r.rateKind) },
    { id: 'version', header: 'Version', nowrap: true, cell: (r) => `Version ${r.version}${r.source === 'import' ? ' · imported' : ''}` },
    { id: 'rate', header: 'Rate', align: 'right', nowrap: true, cell: (r) => <Quantity value={r.rate} uom={uom ? `${uom}/${r.timebase}` : null} /> },
    { id: 'perSecond', header: 'Per second', align: 'right', nowrap: true, cell: (r) => <Quantity value={r.ratePerSecond} uom={uom ? `${uom}/s` : null} fractionDigits={8} /> },
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
    {
      id: 'actions',
      header: 'Actions',
      cell: (r) => (
        <div data-testid="rate-row" data-kind={r.rateKind} data-version={r.version} data-state={r.state}>
          <VersionActions resource="rates" id={r.id} state={r.state} timezone={timezone} testId="rate-actions" authorId={r.createdBy} />
        </div>
      ),
    },
  ];
}

/**
 * Effective-dated rate versions of a profile (20 per page): kind × version with the server's per-second
 * conversion; add a draft, approve (overlaps refused by the server with the conflicting version), retire.
 */
export function RateTable({ profile, timezone }: RateTableProps) {
  const { canWriteProfiles } = useCapabilities();
  const rates = useProfileRates(profile.id);
  const [adding, setAdding] = useState(false);
  const items = byKind(flattenPages(rates.data?.pages));
  const add = !adding && canWriteProfiles && (
    <Button size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="rate-add">
      <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
      Add rate version
    </Button>
  );
  return (
    <Section title="Rates" actions={add || undefined}>
      <div className="space-y-3" data-testid="rate-table">
        {adding && <RateForm profileId={profile.id} timebase={profile.rateTimebase} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />}
        <DataTable
          caption="Rate versions"
          columns={columnsOf(profile, timezone)}
          rows={items}
          getRowKey={(r) => r.id}
          status={{ isLoading: rates.isLoading, isError: rates.isError, error: rates.error, onRetry: () => void rates.refetch() }}
          empty={{ text: 'No rate versions yet. Plans need approved planning and sustained rates.' }}
        />
        {rates.hasNextPage && (
          <Button size="sm" variant="ghost" onClick={() => void rates.fetchNextPage()} disabled={rates.isFetchingNextPage}>
            Load older rate versions
          </Button>
        )}
      </div>
    </Section>
  );
}
