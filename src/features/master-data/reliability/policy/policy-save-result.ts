import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import { sectionNameOf } from '../../components/master-data-sections';

export const STOP_POLICY_PATH = '/master-data/stop-policy';

/** A recorded policy version as every oee_policy view returns it. */
export interface RecordedPolicyVersion {
  version: number;
  effectiveFrom: string;
}

export interface PolicySaveResultInput {
  /** "Stop-engine settings", "Micro-stop settings", "Grade-change allowance" */
  what: string;
  saved: RecordedPolicyVersion;
  /** the scope chosen on the page; '' = the plant */
  unitId: string;
  /** plant clock text of the effective time */
  dateTime: (iso: string) => string;
  capabilities?: Capabilities;
}

const pageOf = (unitId: string) => (unitId ? `${STOP_POLICY_PATH}?unitId=${encodeURIComponent(unitId)}` : STOP_POLICY_PATH);

/**
 * The result dialog of a new policy version (DECISIONS 2026-10-22 "Save feedback"): "<what> version N
 * recorded", where and from when it applies, Back to Stop and plan policy · Next: <setup page>.
 */
export function policySaveResult({ what, saved, unitId, dateTime, capabilities }: PolicySaveResultInput): SaveResult {
  const scope = unitId ? 'Applies to the chosen unit' : 'Applies plant-wide';
  return {
    title: `${what} version ${saved.version} recorded`,
    message: `${scope} from ${dateTime(saved.effectiveFrom)}. Periods already calculated keep the version they used.`,
    listPath: pageOf(unitId),
    listLabel: sectionNameOf(STOP_POLICY_PATH),
    next: nextSetupLink(STOP_POLICY_PATH, { unitId: unitId || undefined, capabilities }),
  };
}
