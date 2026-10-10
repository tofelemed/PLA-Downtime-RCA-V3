import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FxRateView } from '@/api/v2/types/valuation';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '@/features/plans-profiles-calendars/components/version-state-badge';
import { FxVersionActions } from './fx-version-actions';

export interface FxRateTableProps {
  rates: readonly FxRateView[];
  timezone: string;
}

/** FX rate versions in server order; the rate is the server's decimal string, shown unrounded. */
export function FxRateTable({ rates, timezone }: FxRateTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pair</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Rate</TableHead>
          <TableHead>Effective [from, to)</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rates.map((rate) => (
          <TableRow key={rate.id} data-testid="fx-row" data-id={rate.id} data-source={rate.source ?? ''}>
            <TableCell>
              {rate.fromCurrency} → {rate.toCurrency}
            </TableCell>
            <TableCell>v{rate.version}</TableCell>
            <TableCell className="font-mono text-xs" data-testid="fx-rate">
              1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}
            </TableCell>
            <TableCell className="text-xs">
              <PlantTime iso={rate.effectiveFrom} tz={timezone} withDate /> →{' '}
              {rate.effectiveTo ? <PlantTime iso={rate.effectiveTo} tz={timezone} withDate /> : 'open-ended'}
            </TableCell>
            <TableCell className="text-xs">{rate.source ?? '—'}</TableCell>
            <TableCell>
              <VersionStateBadge state={rate.state} />
            </TableCell>
            <TableCell className="min-w-[16rem]">
              <FxVersionActions id={rate.id} state={rate.state} timezone={timezone} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
