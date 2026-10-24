import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';

/**
 * QA L22: valuation rates (margins, costs, price differences) are versions of each production profile, so
 * Valuation links to them beside the page title; users who cannot open Profiles & rates get no link.
 */
export function ValuationRatesLink() {
  const { canViewAnalysis } = useCapabilities();
  if (!canViewAnalysis) return null;
  return (
    <Button asChild size="sm" variant="outline" className="whitespace-nowrap" data-testid="valuation-rates-link">
      <Link to="/setup/profiles" title="Margins, costs and price differences are kept on each production profile">
        <ActionIcon.view className="h-4 w-4" aria-hidden="true" />
        Profile valuation rates
      </Link>
    </Button>
  );
}
