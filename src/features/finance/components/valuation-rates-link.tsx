import { Link } from 'react-router-dom';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * QA L22: valuation rates (margins, costs, price differences) are versions of each production profile, so
 * Finance points to them; a user who cannot open planning reads the sentence without a link.
 */
export function ValuationRatesLink() {
  const { canViewAnalysis } = useCapabilities();
  const page = pageNameOf('/setup/profiles');
  return (
    <p className="text-sm text-muted-foreground" data-testid="valuation-rates-link">
      Valuation rates (margins, costs, price differences) are kept on each production profile:{' '}
      {canViewAnalysis ? (
        <Link className="underline" to="/setup/profiles">
          Setup › {page}
        </Link>
      ) : (
        `Setup › ${page}`
      )}
      .
    </p>
  );
}
