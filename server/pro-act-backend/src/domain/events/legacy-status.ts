import {
  CodingState,
  EventStates,
  PhysicalState,
  RcaState,
} from './event-classification';

/** v1 status labels the current UI reads and writes (AdminPanel status lists, Event Hub badges). */
export const LEGACY_STATUSES = [
  'Open',
  'Coded',
  'RCA Required',
  'Investigating',
  'In Progress',
  'Completed',
  'Closed',
  'Cancelled',
] as const;
export type LegacyStatus = (typeof LEGACY_STATUSES)[number];

/** Facts about the row the label alone cannot carry. */
export interface LegacyStatusContext {
  hasEnd: boolean;
  hasReasonCode: boolean;
  hasRca: boolean;
}

/**
 * Three state dimensions → the single v1 `status` label (DT11). The adapter is the only writer of
 * `production_events.status`; precedence follows what the v1 UI needs to show first.
 */
export function toLegacyStatus(states: EventStates): LegacyStatus {
  // a superseded split/merge contributor is no longer an active event for v1 (plan 1.4)
  if (
    states.physicalState === 'retracted' ||
    states.physicalState === 'superseded'
  ) {
    return 'Cancelled';
  }
  if (states.rcaState === 'required') return 'RCA Required';
  if (states.rcaState === 'linked') return 'Investigating';
  if (states.rcaState === 'completed') return 'Completed';
  if (states.codingState === 'reviewed') return 'Closed';
  if (states.codingState === 'coded') return 'Coded';
  return 'Open';
}

/**
 * v1 `status` (or none) → states. The physical state comes from the interval (an end time closes it)
 * unless the label retracts the event; unknown labels keep only what the row itself says.
 */
export function fromLegacyStatus(
  status: string | null | undefined,
  context: LegacyStatusContext,
): EventStates {
  return {
    physicalState: physicalStateOf(status, context),
    codingState: codingStateOf(status, context),
    rcaState: rcaStateOf(status, context),
  };
}

function physicalStateOf(
  status: string | null | undefined,
  context: LegacyStatusContext,
): PhysicalState {
  if (status === 'Cancelled') return 'retracted';
  return context.hasEnd ? 'closed' : 'open';
}

function codingStateOf(
  status: string | null | undefined,
  context: LegacyStatusContext,
): CodingState {
  if (status === 'Closed' || status === 'Completed') return 'reviewed';
  if (status === 'Coded' || context.hasReasonCode) return 'coded';
  return 'uncoded';
}

function rcaStateOf(
  status: string | null | undefined,
  context: LegacyStatusContext,
): RcaState {
  switch (status) {
    case 'RCA Required':
      return 'required';
    case 'Investigating':
    case 'In Progress':
      return 'linked';
    case 'Completed':
    case 'Closed':
      return context.hasRca ? 'completed' : 'none';
    default:
      return context.hasRca ? 'linked' : 'none';
  }
}
