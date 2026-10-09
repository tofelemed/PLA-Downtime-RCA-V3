import type { EventStatesView } from '@/api/v2/types/events';

/**
 * Display of the three DT11 state dimensions the API sends (physical / coding / RCA). Only labels and
 * tones live here — the states themselves are always the server's (no local status rules, B15).
 */
export type StateTone = 'neutral' | 'active' | 'warning' | 'success' | 'muted';

export interface StateChip {
  dimension: 'physical' | 'coding' | 'rca';
  value: string;
  label: string;
  tone: StateTone;
}

const PHYSICAL: Readonly<Record<string, [string, StateTone]>> = {
  open: ['Running', 'active'],
  closed: ['Ended', 'neutral'],
  superseded: ['Superseded', 'muted'],
  retracted: ['Retracted', 'muted'],
};

const CODING: Readonly<Record<string, [string, StateTone]>> = {
  uncoded: ['Uncoded', 'warning'],
  coded: ['Coded', 'success'],
  reviewed: ['Reviewed', 'success'],
};

const RCA: Readonly<Record<string, [string, StateTone]>> = {
  none: ['No RCA', 'muted'],
  required: ['RCA required', 'warning'],
  linked: ['RCA linked', 'active'],
  completed: ['RCA completed', 'success'],
};

function chip(dimension: StateChip['dimension'], table: typeof PHYSICAL, value: string): StateChip {
  const [label, tone] = table[value] ?? [value, 'neutral'];
  return { dimension, value, label, tone };
}

/** The three chips, in fixed order; an unknown value is shown as sent (never hidden or guessed). */
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
  rca: 'RCA state',
};

export function dimensionLabel(dimension: StateChip['dimension']): string {
  return DIMENSION_LABEL[dimension];
}

/** Human label of an enum value (`quality_loss` → "Quality loss"). */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
