/**
 * The empty-state sentence (QA L13): an invitation to register only for users who can register; others
 * learn who does it instead of being asked for an action they cannot take.
 */
export function standbyEmptyText(canWrite: boolean): string {
  return canWrite
    ? 'Register spare pumps or standby compressors to measure failures on demand.'
    : 'No spare pumps or standby compressors are registered yet. Reliability engineers register them to measure failures on demand.';
}
