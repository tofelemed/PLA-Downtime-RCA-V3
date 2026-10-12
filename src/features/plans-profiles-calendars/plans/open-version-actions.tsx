import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGeneratePeriods, usePreviewPeriods } from '@/api/v2/queries/plans';
import { DISTRIBUTIONS, type Distribution, type PlanVersionView } from '@/api/v2/types/plans';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { refusalTitle } from '@/features/ux-kit/errors';
import { DISTRIBUTION_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { ApprovePlanVersion } from './approve-plan-version';
import { PeriodPreview } from './period-preview';
import { SubmitPlanVersion } from './submit-plan-version';

export interface OpenVersionActionsProps {
  version: PlanVersionView;
  timezone: string;
  productName: (id: string | null | undefined) => string;
  /** a generation was accepted (202): the parent follows the job across version refreshes */
  onGenerated: (jobId: string) => void;
}

function GeneratedNote({ version, timezone }: { version: PlanVersionView; timezone: string }) {
  return (
    <p className="text-xs text-muted-foreground" data-testid="periods-generated">
      {version.periodsGeneratedAt ? (
        <>
          Periods generated <PlantTime iso={version.periodsGeneratedAt} tz={timezone} withDate />
        </>
      ) : (
        'Periods not generated yet — approval needs generated periods.'
      )}
      {version.generationError ? ` · last generation refused: ${refusalTitle(version.generationError.code, null)}` : ''}
    </p>
  );
}

/**
 * Draft / submitted version: edit, preview (nothing stored; refusals as a notice), generate (202 job),
 * submit for approval, approve or return. Every number in the preview is the server's.
 */
export function OpenVersionActions({ version, timezone, productName, onGenerated }: OpenVersionActionsProps) {
  const { canWritePlans } = useCapabilities();
  const preview = usePreviewPeriods();
  const generate = useGeneratePeriods();
  const [distribution, setDistribution] = useState<Distribution | ''>('');
  const input = { planId: version.planId, version: version.version, ...(distribution ? { distribution } : {}) };
  const runPreview = () => preview.submit(input).catch(() => undefined);
  const runGenerate = async () => {
    const accepted = await generate.submit(input).catch(() => null);
    if (accepted) onGenerated(accepted.jobId);
  };
  const distributionOptions = DISTRIBUTIONS.map((d) => ({ value: d, label: DISTRIBUTION_LABELS[d] }));
  return (
    <div className="space-y-3" data-testid="open-version-actions">
      {canWritePlans && (
        <div className="flex flex-wrap items-end gap-2">
          <Button asChild size="sm" variant="outline" data-testid="plan-edit">
            <Link to={`/planning/plans/${version.planId}/versions/${version.version}/edit`}>
              <ActionIcon.edit className="h-4 w-4" aria-hidden="true" />
              Edit draft
            </Link>
          </Button>
          <div className="w-72">
            <FormField id="previewDistribution" label="Distribution for the preview">
              <NativeSelect id="previewDistribution" value={distribution} options={distributionOptions} placeholder={`As saved: ${labelOf(DISTRIBUTION_LABELS, version.distribution)}`} onChange={(v) => setDistribution(v as Distribution | '')} />
            </FormField>
          </div>
          <Button size="sm" onClick={runPreview} disabled={preview.isPending} data-testid="plan-preview">
            Preview periods
          </Button>
          <Button size="sm" variant="secondary" onClick={runGenerate} disabled={generate.isPending} data-testid="plan-generate">
            Generate periods
          </Button>
          <SubmitPlanVersion version={version} timezone={timezone} />
        </div>
      )}
      <GeneratedNote version={version} timezone={timezone} />
      <RefusalNotice error={preview.error} timezone={timezone} />
      <RefusalNotice error={generate.error} timezone={timezone} />
      {preview.data && !preview.error && <PeriodPreview preview={preview.data} headerTarget={version.headerTarget} timezone={timezone} productName={productName} />}
      <ApprovePlanVersion version={version} timezone={timezone} />
    </div>
  );
}
