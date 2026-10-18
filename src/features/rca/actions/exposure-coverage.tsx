import type { RcaExposureWindow } from '@/api/v2/types/rca-workflow';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/**
 * The known-data coverage the server reported for an exposure window (rca-exposure-v3, SME D2): time
 * without state data is never counted as run time. Nothing is shown for windows counted before v3.
 */
export function ExposureCoverage({ window }: { window: RcaExposureWindow }) {
  const { percent, digits } = useNumberFormat();
  if (window.coverage === undefined || window.coverage === null) return null;
  const unknown = Number(window.unknownSeconds ?? '0');
  return (
    <span data-testid="exposure-coverage">
      {' '}
      · state data covers {percent(Number(window.coverage) * 100, 1)} of the window
      {unknown > 0 ? ` (${formatDuration(window.unknownSeconds ?? '0', 'long', digits)} without data, not counted as run time)` : ''}
    </span>
  );
}
