import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGeneratePeriods, usePreviewPeriods } from '@/api/v2/queries/plans';
import { DISTRIBUTIONS, type Distribution, type PlanVersionView } from '@/api/v2/types/plans';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { ApprovePlanVersion } from './approve-plan-version';
import { PeriodPreview } from './period-preview';

export interface OpenVersionActionsProps {
  version: PlanVersionView;
  timezone: string;
  productName: (id: string | null | undefined) => string;
  onEdit: () => void;
  /** a generation was accepted (202): the parent follows the job across version refreshes */
  onGenerated: (jobId: string) => void;
}

/**
 * Draft / submitted version: edit, preview (PLAN03, 200 — nothing stored; 422 NO_ELIGIBLE_TIME etc. as a
 * banner), generate (202 job) and approve. Every number in the preview is the server's.
 */
export function OpenVersionActions({ version, timezone, productName, onEdit, onGenerated }: OpenVersionActionsProps) {
  const preview = usePreviewPeriods();
  const generate = useGeneratePeriods();
  const [distribution, setDistribution] = useState<Distribution | ''>('');
  const input = { planId: version.planId, version: version.version, ...(distribution ? { distribution } : {}) };
  const runPreview = () => preview.submit(input).catch(() => undefined);
  const runGenerate = async () => {
    const accepted = await generate.submit(input).catch(() => null);
    if (accepted) onGenerated(accepted.jobId);
  };
  return (
    <div className="space-y-3" data-testid="open-version-actions">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} data-testid="plan-edit">
          Edit draft
        </Button>
        <div className="w-64">
          <NativeSelect id="previewDistribution" value={distribution} options={DISTRIBUTIONS.map((d) => ({ value: d, label: d }))} placeholder={`Distribution: ${version.distribution}`} onChange={(v) => setDistribution(v as Distribution | '')} />
        </div>
        <Button size="sm" onClick={runPreview} disabled={preview.isPending} data-testid="plan-preview">
          Preview periods
        </Button>
        <Button size="sm" variant="secondary" onClick={runGenerate} disabled={generate.isPending} data-testid="plan-generate">
          Generate periods
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="periods-generated">
        {version.periodsGeneratedAt ? `Periods generated ${version.periodsGeneratedAt}` : 'Periods not generated yet — approval needs generated periods.'}
        {version.generationError ? ` · last generation refused: ${version.generationError.code}` : ''}
      </p>
      <RefusalNotice error={preview.error} timezone={timezone} />
      <RefusalNotice error={generate.error} timezone={timezone} />
      {preview.data && !preview.error && <PeriodPreview preview={preview.data} headerTarget={version.headerTarget} timezone={timezone} productName={productName} />}
      <ApprovePlanVersion version={version} timezone={timezone} />
    </div>
  );
}
