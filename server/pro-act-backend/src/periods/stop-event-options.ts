import { PolicyBodyError } from './policy-bodies';

/**
 * Plan 1.10 / DT-04 / SME D5 stop-event settings of an `oee_policy` version (contract `stopEvents`):
 * whether the state engine derives stop events, its DT02 debounce and restart confirmation, the duplicate
 * merge tolerance and whether matching duplicates merge automatically, and the repeat-stop incident window.
 */
export interface StopEventOptions {
  deriveFromState: boolean;
  debounceSeconds: number;
  restartConfirmSeconds: number;
  duplicateToleranceSeconds: number;
  autoMergeDuplicates: boolean;
  incidentWindowSeconds: number;
}

/**
 * Pilot defaults (engineering default, DECISIONS "State engine and stop reconciliation"): DT02 5 s debounce
 * and 10 s restart confirmation, SME D5 2-minute incident window, 120 s duplicate tolerance. Used when a
 * version does not state the option (every version written before it).
 */
export const STOP_EVENT_DEFAULTS: StopEventOptions = {
  deriveFromState: true,
  debounceSeconds: 5,
  restartConfirmSeconds: 10,
  duplicateToleranceSeconds: 120,
  autoMergeDuplicates: true,
  incidentWindowSeconds: 120,
};

const SECONDS_FIELDS = [
  'debounceSeconds',
  'restartConfirmSeconds',
  'duplicateToleranceSeconds',
  'incidentWindowSeconds',
] as const;
const FLAG_FIELDS = ['deriveFromState', 'autoMergeDuplicates'] as const;

/** Upper bound of every stop-event duration setting (one day). */
const MAX_SECONDS = 86_400;

function seconds(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_SECONDS
  ) {
    throw new PolicyBodyError(
      `stopEvents.${field} must be whole seconds between 0 and ${MAX_SECONDS}`,
    );
  }
  return value;
}

/** The `stopEvents` option of a body as stated (absent → nothing); each field optional. */
export function parseStopEventOptions(
  value: unknown,
): Partial<StopEventOptions> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PolicyBodyError('stopEvents must be an object');
  }
  const raw = value as Record<string, unknown>;
  const known = new Set<string>([...SECONDS_FIELDS, ...FLAG_FIELDS]);
  const unknown = Object.keys(raw).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new PolicyBodyError(
      `stopEvents has unknown fields: ${unknown.join(', ')}`,
    );
  }
  const options: Partial<StopEventOptions> = {};
  for (const field of SECONDS_FIELDS) {
    if (raw[field] !== undefined) options[field] = seconds(raw[field], field);
  }
  for (const field of FLAG_FIELDS) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== 'boolean') {
      throw new PolicyBodyError(`stopEvents.${field} must be a boolean`);
    }
    options[field] = raw[field];
  }
  return options;
}

/** Settings in force: the version's stated options over the pilot defaults. */
export function stopEventSettings(policy: {
  stopEvents?: Partial<StopEventOptions>;
}): StopEventOptions {
  return { ...STOP_EVENT_DEFAULTS, ...(policy.stopEvents ?? {}) };
}
