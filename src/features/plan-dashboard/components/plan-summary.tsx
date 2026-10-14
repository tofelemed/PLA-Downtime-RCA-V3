import { Link } from 'react-router-dom';
import type { PlanView } from '@/api/v2/types/plans';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { BASIS_SHORT_LABELS, labelOf, VERSION_STATE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';

export interface PlanSummaryProps {
  plan: PlanView;
  timezone: string;
}

/** The plan behind the periods: version, window, basis and header target (changed on the plan's page). */
export function PlanSummary({ plan, timezone }: PlanSummaryProps) {
  const version = plan.version;
  const { decimal } = useNumberFormat();
  return (
    <Section title={`Version ${version.version} · ${labelOf(VERSION_STATE_LABELS, version.approvalState)}`}>
      <div className="space-y-2 text-sm" data-testid="plan-summary">
        <p>
          Window <PlantTime iso={version.validFrom} tz={timezone} withDate /> → <PlantTime iso={version.validTo} tz={timezone} withDate />
        </p>
        <p>
          {labelOf(BASIS_SHORT_LABELS, version.basis)}; header target {decimal(version.headerTarget)} (in the unit of each slice’s profile)
        </p>
        <p>{version.periodsGeneratedAt ? 'Plan periods generated.' : 'Plan periods not generated yet.'}</p>
        <Link className="underline" to={`/planning/plans/${plan.id}`}>
          Open the plan (versions, preview, approval)
        </Link>
      </div>
    </Section>
  );
}
