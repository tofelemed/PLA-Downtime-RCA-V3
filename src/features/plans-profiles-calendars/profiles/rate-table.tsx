import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useProfileRates } from '@/api/v2/queries/profiles';
import { RATE_KINDS, type ProfileView, type RateView } from '@/api/v2/types/profiles';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { VersionStateBadge } from '../components/version-state-badge';
import { RateForm } from './rate-form';
import { VersionActions } from './version-actions';

export interface RateTableProps {
  profile: ProfileView;
  timezone: string;
}

/** Rows in kind order (§3.1: nameplate … forecast are separate values), versions in server order within a kind. */
function byKind(rates: readonly RateView[]): RateView[] {
  const order = new Map<string, number>(RATE_KINDS.map((kind, index) => [kind, index]));
  return [...rates].sort((a, b) => (order.get(a.rateKind) ?? 99) - (order.get(b.rateKind) ?? 99) || a.version - b.version);
}

/**
 * Effective-dated rate versions of a profile (PLAN01, PLAN06): kind × version with the server's per-second
 * conversion; add a draft, approve (overlaps refused by the API with the conflicting version shown inline),
 * supersede, retire.
 */
export function RateTable({ profile, timezone }: RateTableProps) {
  const rates = useProfileRates(profile.id);
  const [adding, setAdding] = useState(false);
  const items = byKind(flattenPages(rates.data?.pages));
  return (
    <section className="space-y-2" data-testid="rate-table">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Rates</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="rate-add">
            Add rate version
          </Button>
        )}
      </div>
      {adding && <RateForm profileId={profile.id} timebase={profile.rateTimebase} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />}
      <DataState state={dataStateOf(rates, { isEmpty: items.length === 0 })} error={rates.error} detail="No rate versions yet. Plans need approved planning and sustained rates.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Per second (server)</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((rate) => (
              <TableRow key={rate.id} data-testid="rate-row" data-kind={rate.rateKind} data-version={rate.version} data-state={rate.state}>
                <TableCell>{rate.rateKind}</TableCell>
                <TableCell>v{rate.version}{rate.source === 'import' ? ` · import ${rate.externalId ?? ''}` : ''}</TableCell>
                <TableCell>
                  <Quantity value={rate.rate} uom={profile.quantityUom ? `${profile.quantityUom}/${rate.timebase}` : null} />
                </TableCell>
                <TableCell>
                  <Quantity value={rate.ratePerSecond} uom={profile.quantityUom ? `${profile.quantityUom}/s` : null} fractionDigits={8} />
                </TableCell>
                <TableCell className="text-xs">
                  <PlantTime iso={rate.effectiveFrom} tz={timezone} withDate /> → {rate.effectiveTo ? <PlantTime iso={rate.effectiveTo} tz={timezone} withDate /> : 'open'}
                </TableCell>
                <TableCell>
                  <VersionStateBadge state={rate.state} />
                </TableCell>
                <TableCell className="min-w-[16rem]">
                  <VersionActions resource="rates" id={rate.id} state={rate.state} timezone={timezone} testId="rate-actions" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataState>
    </section>
  );
}
