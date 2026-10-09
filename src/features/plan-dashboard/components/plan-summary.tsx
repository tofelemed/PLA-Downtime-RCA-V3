import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanView } from '@/api/v2/types/plans';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { formatDecimal } from '@/features/ux-kit/format/decimal';

export interface PlanSummaryProps {
  plan: PlanView;
  timezone: string;
}

/** The plan behind the periods: version, window, basis and header target (edited under /planning). */
export function PlanSummary({ plan, timezone }: PlanSummaryProps) {
  const version = plan.version;
  return (
    <Card data-testid="plan-summary">
      <CardHeader>
        <CardTitle className="text-base">
          {plan.name} · version {version.version} ({version.approvalState})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          Window <PlantTime iso={version.validFrom} tz={timezone} withDate /> → <PlantTime iso={version.validTo} tz={timezone} withDate />
        </p>
        <p>
          Basis {version.basis}; header target {formatDecimal(version.headerTarget)} (in the unit of each slice’s profile)
        </p>
        <p>{version.periodsGeneratedAt ? 'Plan periods generated.' : 'Plan periods not generated yet.'}</p>
        <Link className="underline" to="/planning?tab=plans">
          Edit plans, profiles and calendars
        </Link>
      </CardContent>
    </Card>
  );
}
