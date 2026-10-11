import { SourceType } from '../intake/envelope/canonical-envelope';

/**
 * `source_mappings.source_system` vocabulary (spec ING03): the connector a rule applies to (`PI`,
 * `MQTT`, ...) or `*` for every connector. Resolution loads the rules of one source system plus the
 * `*` rules, so a lookup must pass the value the writers store: both sides go through this module.
 */
export const DEFAULT_SOURCE_SYSTEM = 'PI';

/**
 * A v1 `source_hierarchy_mappings.source_type` (`PI`, `MQTT`, `OPCUA`, `*`, ...) is mirrored as it is,
 * so the v1 lookup resolves under the same word.
 */
export function legacySourceSystem(sourceType: string | undefined): string {
  const value = sourceType?.trim();
  return value ? value : DEFAULT_SOURCE_SYSTEM;
}

/** Connectors with an ingest path; the rules of the others keep the PI default. */
const CONNECTION_SOURCE_SYSTEMS: Partial<Record<SourceType, string>> = {
  pi_web_api: 'PI',
  mqtt: 'MQTT',
};

/** `source_system` of the rules a v2 connection (`integration_connections.source_type`) resolves against. */
export function connectionSourceSystem(sourceType: SourceType): string {
  return CONNECTION_SOURCE_SYSTEMS[sourceType] ?? DEFAULT_SOURCE_SYSTEM;
}
