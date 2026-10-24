import { InfoMark } from '@/features/plans-profiles-calendars/components/info-mark';

const TEXT =
  'Approving revalues the periods it covers: an approval queues a recalculation of the periods its validity covers. Lost tonnes never change; open periods are revalued and approved periods get a change proposal to review, never an overwrite. A period without an approved rate shows its value as not valued, never zero.';

/**
 * SME V7 (14 Oct 2026): approving a policy, FX rate, valuation rate or demand status queues a
 * recalculation of the periods it values; approved periods get a change proposal. Said once, behind the ⓘ
 * beside the page title.
 */
export function RecalculationNotice() {
  return <InfoMark label="approvals and revaluation" text={TEXT} testId="recalculation-notice" />;
}
