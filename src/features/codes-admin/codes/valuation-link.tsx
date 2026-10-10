import { useImpactValuationRates } from '@/api/v2/queries/codes-admin';
import { Badge } from '@/components/ui/badge';

/** Valuation link of an impact code (plan 2.6): valuation rate versions exist, or a cost on the code, or none. */
export function ValuationLink({ impactCodeId, costPerHour }: { impactCodeId: string; costPerHour: string | null }) {
  const rates = useImpactValuationRates(impactCodeId);
  if (rates.isLoading) return null;
  if (rates.items.length > 0) {
    return (
      <Badge variant="outline" data-testid="valuation-link" data-link="rates">
        Valued: {rates.items.length} valuation rate version(s)
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="valuation-link" data-link={costPerHour ? 'cost' : 'none'}>
      {costPerHour ? `Cost on code: ${costPerHour}/h (no valuation rate)` : 'Not valued'}
    </Badge>
  );
}
