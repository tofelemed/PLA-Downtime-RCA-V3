import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useValuationRates } from '@/api/v2/queries/profiles';
import type { ProfileView } from '@/api/v2/types/profiles';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { VersionStateBadge } from '../components/version-state-badge';
import { ValuationRateForm } from './valuation-rate-form';
import { VersionActions } from './version-actions';

export interface ValuationRateTableProps {
  profile: ProfileView;
  timezone: string;
}

/** The v1 product cost kept on a seeded profile: shown for review, never used (D08 Q3 open). */
function LegacyCost({ profile }: { profile: ProfileView }) {
  const legacy = profile.legacy?.standardRate;
  if (legacy === undefined || legacy === null) return null;
  return (
    <p className="text-sm" data-testid="legacy-cost">
      <Badge variant="outline" className="mr-2 border-amber-500 text-amber-700">
        Unconfirmed legacy cost
      </Badge>
      v1 standard rate {String(legacy)} (no currency) — not used for valuation until finance confirms it (D08 Q3).
    </p>
  );
}

/** Margin / standard-cost versions of the profile (VAL01): basis, value, currency, validity and approval. */
export function ValuationRateTable({ profile, timezone }: ValuationRateTableProps) {
  const rates = useValuationRates(profile.id);
  const [adding, setAdding] = useState(false);
  const items = flattenPages(rates.data?.pages);
  return (
    <section className="space-y-2" data-testid="valuation-rate-table">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Valuation rates</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            Add valuation rate
          </Button>
        )}
      </div>
      <LegacyCost profile={profile} />
      {adding && <ValuationRateForm profileId={profile.id} uom={profile.quantityUom} timezone={timezone} onDone={() => setAdding(false)} />}
      <DataState state={dataStateOf(rates, { isEmpty: items.length === 0 })} error={rates.error} detail="No valuation rates: losses of this profile stay unvalued.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Basis</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((rate) => (
              <TableRow key={rate.id} data-testid="valuation-row">
                <TableCell>{rate.basis}</TableCell>
                <TableCell>v{rate.version}</TableCell>
                <TableCell>
                  <Quantity value={rate.value} uom={`${rate.currency}/${rate.perUom}`} />
                </TableCell>
                <TableCell className="text-xs">
                  <PlantTime iso={rate.effectiveFrom} tz={timezone} withDate /> → {rate.effectiveTo ? <PlantTime iso={rate.effectiveTo} tz={timezone} withDate /> : 'open'}
                </TableCell>
                <TableCell>
                  <VersionStateBadge state={rate.state} />
                </TableCell>
                <TableCell className="min-w-[16rem]">
                  <VersionActions resource="valuation-rates" id={rate.id} state={rate.state} timezone={timezone} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataState>
    </section>
  );
}
