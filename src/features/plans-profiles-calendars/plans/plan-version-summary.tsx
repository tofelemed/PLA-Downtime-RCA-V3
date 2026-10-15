import type { PlanVersionView } from '@/api/v2/types/plans';
import { BASIS_SHORT_LABELS, DISTRIBUTION_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { VersionStateBadge } from '../components/version-state-badge';

/** Header targets use each slice's profile unit; only generated periods carry a frozen quantity UOM. */
export function PlanVersionSummary({ version, timezone }: { version: PlanVersionView; timezone: string }) {
  const { decimal } = useNumberFormat();
  return (
    <div className="space-y-2 text-sm" data-testid="plan-summary">
      <p className="flex flex-wrap items-center gap-2">
        <VersionStateBadge state={version.approvalState} />
        <span>{labelOf(BASIS_SHORT_LABELS, version.basis)} · {labelOf(DISTRIBUTION_LABELS, version.distribution)}</span>
      </p>
      <p>
        Header target: <span className="font-medium tabular-nums">{decimal(version.headerTarget)}</span>
        {version.headerTarget != null && <span className="text-muted-foreground"> (in the unit of each slice’s profile)</span>}
      </p>
      <p className="text-muted-foreground">
        <PlantTime iso={version.validFrom} tz={timezone} withDate /> → <PlantTime iso={version.validTo} tz={timezone} withDate />
      </p>
    </div>
  );
}
