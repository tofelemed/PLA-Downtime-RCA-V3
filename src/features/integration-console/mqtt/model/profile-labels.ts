import { IDENTITY_STRATEGIES, PROFILE_PRESETS, type ProfileKind } from './mqtt-form';

/** Plain words for the payload profile keys (QA M7): never `seq_boot`, `measurement_json` on screen. */
export const IDENTITY_STRATEGY_LABELS: Readonly<Record<(typeof IDENTITY_STRATEGIES)[number], string>> = {
  seq_boot: 'Gateway boot and sequence number (samples, state, availability)',
  event_id: 'Event id and revision (events)',
  payload_hash: 'Message content and event time (no ids from the source)',
};

export const DEFAULT_IDENTITY_LABEL = `${IDENTITY_STRATEGY_LABELS.seq_boot} (default)`;

/** The identity strategy's label; the default one when none is stored. */
export function identityStrategyLabel(value: string | null | undefined): string {
  if (!value) return DEFAULT_IDENTITY_LABEL;
  return (IDENTITY_STRATEGY_LABELS as Readonly<Record<string, string>>)[value] ?? value;
}

export const IDENTITY_STRATEGY_OPTIONS = IDENTITY_STRATEGIES.map((value) => ({ value, label: IDENTITY_STRATEGY_LABELS[value] }));

/** The payload profile kind's label ("Measurements (signal samples)"). */
export function profileKindLabel(kind: string): string {
  return PROFILE_PRESETS[kind as ProfileKind]?.label ?? kind;
}
