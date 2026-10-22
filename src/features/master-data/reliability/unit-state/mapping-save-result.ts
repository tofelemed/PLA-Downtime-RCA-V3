import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import { sectionNameOf } from '../../components/master-data-sections';

const UNIT_STATE_PATH = '/master-data/unit-state';

export interface MappingSaveResultInput {
  saved: UnitStateMappingView;
  /** plant clock text of the effective time */
  dateTime: (iso: string) => string;
  /** the time the version was recorded (decides "from" or "takes effect") */
  now: number;
  capabilities?: Capabilities;
}

/**
 * The result dialog of a new mapping version (DECISIONS 2026-10-22): "Mapping version N recorded", when it
 * takes over from the previous version, Back to Unit state · Next: <setup page> for the same unit.
 */
export function mappingSaveResult({ saved, dateTime, now, capabilities }: MappingSaveResultInput): SaveResult {
  const from = dateTime(saved.effectiveFrom);
  const future = Date.parse(saved.effectiveFrom) > now;
  return {
    title: `Mapping version ${saved.version} recorded`,
    message: future
      ? `It takes effect at ${from}; the version in force stays until then.`
      : `In force from ${from}; the previous version ended then.`,
    listPath: `${UNIT_STATE_PATH}?unitId=${encodeURIComponent(saved.unitId)}`,
    listLabel: sectionNameOf(UNIT_STATE_PATH),
    next: nextSetupLink(UNIT_STATE_PATH, { unitId: saved.unitId, capabilities }),
  };
}
