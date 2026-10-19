import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { policyVersionsLabel } from '@/features/ux-kit/labels';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { localizeNumber, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { coverageText } from '../model/display';

export interface SnapshotStatusProps {
  scopeLabel: string;
  timezone: string;
  timezoneIsFallback: boolean;
  /** the page's lead report (the one every widget shares the runs of, T24) */
  response: AnalyticsResponse<{ calculationRunIds: string[] }> | undefined;
  isError?: boolean;
  uom?: string | null;
  baseline?: string | null;
  testId?: string;
  /** the scope shows approved revisions only: coverage is the share of periods approved, never "calculated" */
  approvedOnly?: boolean;
}

const isIncomplete = (response: SnapshotStatusProps['response']) =>
  response !== undefined && (response.coverage.ratio < 1 || response.dataQuality.missingCount > 0);

/**
 * Approved-only figures are approved; what is missing is periods, said by the "incomplete" note. The
 * "Provisional" badge stays for the other causes (a provisional input with every period approved).
 */
function provisionalOf(response: SnapshotStatusProps['response'], approvedOnly: boolean): boolean | undefined {
  if (!response) return undefined;
  return approvedOnly && response.coverage.ratio < 1 ? false : response.isProvisional;
}

/**
 * The page-wide status said once (UI guidelines §2): scope, plant timezone, approved / provisional,
 * as-of, one "incomplete data" note when periods lack a calculation, and — behind "Details" — how many
 * calculation runs and which policy versions the figures come from (never run ids or policy keys).
 */
export function SnapshotStatus(props: SnapshotStatusProps) {
  const { response, testId = 'snapshot-runs' } = props;
  const { digits } = useCalendarPreference();
  const runIds = response?.data.calculationRunIds ?? [];
  const approvedOnly = props.approvedOnly ?? false;
  const coverage = response ? coverageText(formatRatio(String(response.coverage.ratio), 0, digits), approvedOnly) : null;
  return (
    <div className="space-y-1">
      <ScopeHeader
        scopeLabel={props.scopeLabel}
        timezone={props.timezone}
        timezoneIsFallback={props.timezoneIsFallback}
        uom={props.uom}
        baseline={props.baseline}
        isProvisional={provisionalOf(response, approvedOnly)}
        asOf={response?.asOf ?? null}
      />
      {isIncomplete(response) && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="snapshot-incomplete">
          <StatusIcon.warning className="h-3.5 w-3.5" aria-hidden="true" />
          Incomplete data: only {approvedOnly ? 'approved' : 'calculated'} periods are counted ({coverage}).

        </p>
      )}
      <details className="text-xs text-muted-foreground" data-testid={testId} data-run-ids={[...runIds].sort().join(',')}>
        <summary className="cursor-pointer select-none">Details</summary>
        <p className="mt-1">
          {response
            ? `${localizeNumber(runIds.length === 1 ? '1 calculation run' : `${runIds.length} calculation runs`, digits)} · ${policyVersionsLabel(response.policyVersion)} · ${coverage}`
            : props.isError
              ? 'No snapshot for this scope.'
              : 'Loading the snapshot…'}
        </p>
      </details>
    </div>
  );
}
