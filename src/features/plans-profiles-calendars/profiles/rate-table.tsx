import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useProfileRates } from '@/api/v2/queries/profiles';
import { RATE_KINDS, type ProfileView, type RateView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, RATE_KIND_LABELS } from '@/features/ux-kit/labels';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { Section } from '@/features/ux-kit/page-layout';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { FormDialog } from '../components/form-dialog';
import { SETUP_LOOK } from '../model/setup-look';
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

const rowMarker = (r: RateView, children: ReactNode) => (
  <div data-testid="rate-row" data-kind={r.rateKind} data-version={r.version} data-state={r.state}>
    {children}
  </div>
);

/** Without approve rights the Actions column would stay empty (QA planning): it is left out, and the row marker moves to State. */
function columnsOf(profile: ProfileView, timezone: string, withActions: boolean): DataTableColumn<RateView>[] {
  const uom = profile.quantityUom;
  const columns: DataTableColumn<RateView>[] = [
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
          <PlantTime iso={r.effectiveFrom} tz={timezone} withDate withZone={false} /> → {r.effectiveTo ? <PlantTime iso={r.effectiveTo} tz={timezone} withDate withZone={false} /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (r) => (withActions ? <VersionStateBadge state={r.state} /> : rowMarker(r, <VersionStateBadge state={r.state} />)) },
  ];
  if (!withActions) return columns;
  return [
    ...columns,
    {
      id: 'actions',
      header: 'Actions',
      cell: (r) => rowMarker(r, <VersionActions resource="rates" id={r.id} state={r.state} timezone={timezone} testId="rate-actions" authorId={r.createdBy} />),
    },
  ];
}

/**
 * Effective-dated rate versions of a profile (20 per page): kind × version with the server's per-second
 * conversion; add a draft, approve (overlaps refused by the server with the conflicting version), retire.
 * A deep link (`#rate-<id>`) opens the page holding the version, sought on the server when not loaded.
 */
export function RateTable({ profile, timezone }: RateTableProps) {
  const { canWriteProfiles, canApproveProfiles } = useCapabilities();
  const anchor = useAnchorFocus('rate-');
  const rates = useProfileRates(profile.id, anchor.focus);
  const [adding, setAdding] = useState(false);
  const items = byKind(flattenPages(rates.data?.pages));
  useSeekAnchor(anchor, infiniteListState(rates));
  const add = canWriteProfiles && (
    <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setAdding(true)} data-testid="rate-add">
      <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
      Add rate version
    </Button>
  );
  return (
    <ReportLookContext.Provider value={SETUP_LOOK}>
      <Section title="Rates" actions={add || undefined} className="rounded-lg border bg-card p-4">
        <div className="space-y-3" data-testid="rate-table">
          <FocusedListNotice anchor={anchor} what="rate versions" />
          <FormDialog open={adding} onOpenChange={setAdding} title="Add rate version" info="A draft rate version of this profile; another manager approves it." testId="rate-dialog">
            <RateForm profileId={profile.id} timebase={profile.rateTimebase} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />
          </FormDialog>
          <DataTable
            caption="Rate versions"
            columns={columnsOf(profile, timezone, canApproveProfiles)}
            rows={items}
            getRowKey={(r) => r.id}
            getRowAnchor={(r) => `rate-${r.id}`}
            status={{ isLoading: rates.isLoading, isError: rates.isError, error: rates.error, onRetry: () => void rates.refetch() }}
            empty={{ title: 'No rate versions', text: 'No rate versions yet. Plans need approved planning and sustained rates.' }}
          />
          {rates.hasNextPage && (
            <Button size="sm" variant="ghost" onClick={() => void rates.fetchNextPage()} disabled={rates.isFetchingNextPage}>
              Load older rate versions
            </Button>
          )}
        </div>
      </Section>
    </ReportLookContext.Provider>
  );
}
