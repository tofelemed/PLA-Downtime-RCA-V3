import { SaveFailureFrame } from '@/features/ux-kit/save-result';
import { RefusalNotice, type RefusalNoticeProps } from '@/features/plans-profiles-calendars/components/refusal-notice';

/**
 * The red alert of a refused plant-flow save (DECISIONS 2026-10-22 "Save feedback"): `RefusalNotice`, which
 * also lists the routes an overlapping interval collides with, in the kit's `SaveFailureFrame` (scrolls into
 * view and takes focus on each new failure).
 */
export function PlantFlowSaveAlert({ error, ...rest }: RefusalNoticeProps) {
  return (
    <SaveFailureFrame failure={error}>
      <RefusalNotice error={error} {...rest} />
    </SaveFailureFrame>
  );
}
