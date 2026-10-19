import { humanize as humanizeToken } from '@/features/ux-kit/labels';
import {
  CODING_STATE_LABELS,
  type CodingState,
  EVENT_RCA_STATE_LABELS,
  type EventRcaState,
  PHYSICAL_STATE_LABELS,
  type PhysicalState,
} from '@/features/ux-kit/labels/event-labels';
import type { EventStatesView } from '@/api/v2/types/events';
import type { StatusTone } from '@/features/ux-kit/status-tone';

/**
 * Display of the three DT11 state dimensions the API sends (physical / coding / RCA). Only labels and
 * tones live here — the states themselves are always the server's (no local status rules, B15).
 */
export type StateTone = StatusTone;

export interface StateChip {
  dimension: 'physical' | 'coding' | 'rca';
  value: string;
  label: string;
  tone: StateTone;
}

type ChipTable = Readonly<Record<string, readonly [string, StateTone]>>;

function withTones<K extends string>(labels: Readonly<Record<K, string>>, tones: Readonly<Record<K, StateTone>>): ChipTable {
  const entries = (Object.keys(labels) as K[]).map((key) => [key, [labels[key], tones[key]]] as const);
  return Object.fromEntries(entries);
}

/** Labels come from `ux-kit/labels/event-labels.ts` (one source, E-L5); only the tones live here. */
const PHYSICAL = withTones<PhysicalState>(PHYSICAL_STATE_LABELS, { open: 'info', closed: 'neutral', superseded: 'neutral', retracted: 'neutral' });
const CODING = withTones<CodingState>(CODING_STATE_LABELS, { uncoded: 'warning', coded: 'success', reviewed: 'success' });
const RCA = withTones<EventRcaState>(EVENT_RCA_STATE_LABELS, { none: 'neutral', required: 'warning', linked: 'info', completed: 'success' });

function chip(dimension: StateChip['dimension'], table: ChipTable, value: string): StateChip {
  const [label, tone] = table[value] ?? [humanizeToken(value), 'neutral'];
  return { dimension, value, label, tone };
}

/** The three chips, in fixed order; an unknown value is shown humanized (never hidden or guessed). */
export function stateChips(states: EventStatesView): StateChip[] {
  return [
    chip('physical', PHYSICAL, states.physical),
    chip('coding', CODING, states.coding),
    chip('rca', RCA, states.rca),
  ];
}

const DIMENSION_LABEL: Readonly<Record<StateChip['dimension'], string>> = {
  physical: 'Physical state',
  coding: 'Coding state',
  rca: 'Investigation state',
};

export function dimensionLabel(dimension: StateChip['dimension']): string {
  return DIMENSION_LABEL[dimension];
}

/** Human label of an enum value (`quality_loss` → "Quality loss"); "—" when absent. */
export function humanize(value: string | null | undefined): string {
  return value ? humanizeToken(value) : '—';
}
