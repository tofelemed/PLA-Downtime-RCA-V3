import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePlanVersion } from '@/api/v2/queries/plans';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Section } from '@/features/ux-kit/page-layout';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { usePlanTargetUom } from '../hooks/use-plan-target-uom';
import { isOpenVersion } from '../model/plan-form';
import { GenerationProgress } from './generation-progress';
import { OpenVersionActions } from './open-version-actions';
import { PlanReviewNote } from './plan-review-note';
import { PlanVersionSummary } from './plan-version-summary';
import { SlicesTable } from './slices-table';
import { VersionHistory } from './version-history';

export interface PlanDetailProps {
  plan: PlanView;
  refs: PlanningRefs;
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

/** Summary and slices of a loaded version, with the targets' unit from its profiles. */
function VersionFigures({ plan, version, refs }: { plan: PlanView; version: PlanVersionView; refs: PlanningRefs }) {
  const uom = usePlanTargetUom(version);
  return (
    <>
      <PlanVersionSummary version={version} timezone={refs.timezone} uom={uom} />
      <PlanReviewNote plan={plan} version={version} timezone={refs.timezone} />
      <SlicesTable version={version} refs={refs} uom={uom} />
    </>
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
              <VersionFigures plan={plan} version={version} refs={refs} />
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
