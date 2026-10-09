import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlanVersion } from '@/api/v2/queries/plans';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '../components/version-state-badge';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { isOpenVersion } from '../model/plan-form';
import { GenerationProgress } from './generation-progress';
import { OpenVersionActions } from './open-version-actions';
import { VersionHistory } from './version-history';

export interface PlanDetailProps {
  plan: PlanView;
  refs: PlanningRefs;
  onEdit: (version: PlanVersionView) => void;
  onNewVersion: (version: PlanVersionView) => void;
}

function Slices({ version, refs }: { version: PlanVersionView; refs: PlanningRefs }) {
  return (
    <ul className="text-sm" data-testid="plan-slices">
      {(version.slices ?? []).map((slice) => (
        <li key={slice.id}>
          {slice.position + 1}. {refs.productName(slice.productId)} · <PlantTime iso={slice.activeFrom} tz={refs.timezone} withDate /> →{' '}
          <PlantTime iso={slice.activeTo} tz={refs.timezone} withDate />
          {slice.weight ? ` · weight ${slice.weight}` : ''}
          {slice.target ? ` · target ${slice.target}` : ''} · {slice.stream}
        </li>
      ))}
    </ul>
  );
}

/** The plan's current version (with slices), what can be done with it, and its history. */
export function PlanDetail({ plan, refs, onEdit, onNewVersion }: PlanDetailProps) {
  const current = usePlanVersion(plan.id, plan.currentVersion);
  const version = current.data;
  const [jobId, setJobId] = useState<string | null>(null);
  const tz = refs.timezone;
  return (
    <Card data-testid="plan-detail" data-plan-id={plan.id}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {plan.name} · {refs.unitName(plan.version.unitId)} · v{plan.currentVersion}
          <VersionStateBadge state={plan.version.approvalState} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataState state={dataStateOf(current)} error={current.error}>
          {version && (
            <div className="space-y-3">
              <p className="text-sm" data-testid="plan-summary">
                {version.basis} basis · header {version.headerTarget ?? '—'} · {version.distribution} · <PlantTime iso={version.validFrom} tz={tz} withDate /> →{' '}
                <PlantTime iso={version.validTo} tz={tz} withDate />
              </p>
              <Slices version={version} refs={refs} />
              {jobId && <GenerationProgress jobId={jobId} />}
              {isOpenVersion(version) ? (
                <OpenVersionActions key={`${version.id}-${version.rowVersion}`} version={version} timezone={tz} productName={refs.productName} onEdit={() => onEdit(version)} onGenerated={setJobId} />
              ) : (
                <div className="flex flex-wrap items-center gap-2" data-testid="frozen-version">
                  <p className="text-sm text-muted-foreground">Version {version.version} is {version.approvalState}: its periods are frozen. Changes need a new version.</p>
                  <Button size="sm" onClick={() => onNewVersion(version)} data-testid="plan-new-version">
                    Create new version
                  </Button>
                </div>
              )}
            </div>
          )}
        </DataState>
        <VersionHistory planId={plan.id} timezone={tz} />
      </CardContent>
    </Card>
  );
}
