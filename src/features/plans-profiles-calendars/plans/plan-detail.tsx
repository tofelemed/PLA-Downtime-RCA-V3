import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePlanVersion } from '@/api/v2/queries/plans';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { BASIS_SHORT_LABELS, DISTRIBUTION_LABELS, labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { VersionStateBadge } from '../components/version-state-badge';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { isOpenVersion } from '../model/plan-form';
import { GenerationProgress } from './generation-progress';
import { OpenVersionActions } from './open-version-actions';
import { PlanReviewNote } from './plan-review-note';
import { SlicesTable } from './slices-table';
import { VersionHistory } from './version-history';

export interface PlanDetailProps {
  plan: PlanView;
  refs: PlanningRefs;
}

function Summary({ version, tz }: { version: PlanVersionView; tz: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="plan-summary">
      <VersionStateBadge state={version.approvalState} />
      <span>
        {labelOf(BASIS_SHORT_LABELS, version.basis)} · header target {version.headerTarget ? <Quantity value={version.headerTarget} uom={null} /> : '—'} ·{' '}
        {labelOf(DISTRIBUTION_LABELS, version.distribution)}
      </span>
      <span className="text-muted-foreground">
        <PlantTime iso={version.validFrom} tz={tz} withDate /> → <PlantTime iso={version.validTo} tz={tz} withDate />
      </span>
    </p>
  );
}

function FrozenVersion({ version }: { version: PlanVersionView }) {
  const { canWritePlans } = useCapabilities();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="frozen-version">
      <p className="text-sm text-muted-foreground">This version is {version.approvalState === 'approved' ? 'approved' : 'superseded'}: its periods are frozen. Changes need a new version.</p>
      {canWritePlans && (
        <Button asChild size="sm" data-testid="plan-new-version">
          <Link to={`/planning/plans/${version.planId}/versions/new`}>Create new version</Link>
        </Button>
      )}
    </div>
  );
}

/** The plan's current version (with slices), what can be done with it, and its history. */
export function PlanDetail({ plan, refs }: PlanDetailProps) {
  const current = usePlanVersion(plan.id, plan.currentVersion);
  const version = current.data;
  const [jobId, setJobId] = useState<string | null>(null);
  const tz = refs.timezone;
  return (
    <div className="space-y-6" data-testid="plan-detail" data-plan-id={plan.id}>
      <Section title={version ? `Version ${version.version}` : 'Current version'}>
        <DataState state={dataStateOf(current)} error={current.error}>
          {version && (
            <div className="space-y-4">
              <Summary version={version} tz={tz} />
              <PlanReviewNote plan={plan} version={version} timezone={tz} />
              <SlicesTable version={version} refs={refs} />
              {jobId && <GenerationProgress jobId={jobId} />}
              {isOpenVersion(version) ? (
                <OpenVersionActions key={`${version.id}-${version.rowVersion}`} version={version} timezone={tz} productName={refs.productName} onGenerated={setJobId} />
              ) : (
                <FrozenVersion version={version} />
              )}
            </div>
          )}
        </DataState>
      </Section>
      <VersionHistory planId={plan.id} timezone={tz} />
    </div>
  );
}
