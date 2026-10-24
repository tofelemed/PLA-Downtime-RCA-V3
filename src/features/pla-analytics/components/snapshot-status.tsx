import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { policyVersionsLabel } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { localizeNumber, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { coverageText } from '../model/display';

export interface SnapshotStatusProps {
  /** the page's lead report (the one every widget shares the runs of, T24) */
  response: AnalyticsResponse<{ calculationRunIds: string[] }> | undefined;
  isError?: boolean;
  testId?: string;
  /** the scope shows approved revisions only: coverage is the share of periods approved, never "calculated" */
  approvedOnly?: boolean;
  /** plant timezone: with it, "Details" also says when the server produced the figures */
  timezone?: string;
}

const isIncomplete = (response: SnapshotStatusProps['response']) =>
  response !== undefined && (response.coverage.ratio < 1 || response.dataQuality.missingCount > 0);

/**
 * Where the figures come from, said once (UI guidelines §2): one "incomplete data" note when periods lack a
 * calculation and — behind "Details" — how many calculation runs, which policy versions, the coverage and
 * when the server produced them (never run ids or policy keys). Scope, timezone and approval are not
 * repeated: the filter bar, the card's "Provisional" marker and the app header say them (cleanup 24 Oct 2026).
 */
export function SnapshotStatus({ response, isError, testId = 'snapshot-runs', approvedOnly = false, timezone }: SnapshotStatusProps) {
  const { digits } = useCalendarPreference();
  const runIds = response?.data.calculationRunIds ?? [];
  const coverage = response ? coverageText(formatRatio(String(response.coverage.ratio), 0, digits), approvedOnly) : null;
  return (
    <div className="space-y-1">
      {isIncomplete(response) && <IncompleteNote approvedOnly={approvedOnly} coverage={coverage} />}
      <details className="text-xs text-muted-foreground" data-testid={testId} data-run-ids={[...runIds].sort().join(',')}>
        <summary className="cursor-pointer select-none">Details</summary>
        <p className="mt-1">
          {response ? (
            <>
              {localizeNumber(runIds.length === 1 ? '1 calculation run' : `${runIds.length} calculation runs`, digits)} · {policyVersionsLabel(response.policyVersion)} · {coverage}
              {timezone && <AsOf iso={response.asOf} timezone={timezone} />}
            </>
          ) : (
            <NoSnapshot isError={isError} />
          )}
        </p>
      </details>
    </div>
  );
}

function IncompleteNote({ approvedOnly, coverage }: { approvedOnly: boolean; coverage: string | null }) {
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="snapshot-incomplete">
      <StatusIcon.warning className="h-3.5 w-3.5" aria-hidden="true" />
      Incomplete data: only {approvedOnly ? 'approved' : 'calculated'} periods are counted ({coverage}).
    </p>
  );
}

function NoSnapshot({ isError }: { isError?: boolean }) {
  return <>{isError ? 'No snapshot for this scope.' : 'Loading the snapshot…'}</>;
}

function AsOf({ iso, timezone }: { iso: string | null | undefined; timezone: string }) {
  if (!iso) return null;
  return (
    <>
      {' · as of '}
      <PlantTime iso={iso} tz={timezone} withDate withZone={false} />
    </>
  );
}
