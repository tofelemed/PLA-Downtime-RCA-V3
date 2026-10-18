import type { ProductionEventView } from '@/api/v2/types/events';

/** The interval of a non-manual event: PATCH refuses it (409 SOURCE_OWNED), so the form shows it read only. */
export const SOURCE_INTERVAL_FIELDS: readonly string[] = ['startTime', 'endTime', 'durationSeconds'];

/** Field names (PATCH = form names) of the event form a source can own and a user may override, with their labels. */
export const OVERRIDABLE_FORM_FIELDS: Readonly<Record<string, string>> = {
  physicalType: 'Type',
  scheduleClass: 'Schedule class',
  assetId: 'Asset',
  description: 'Description',
  impactMode: 'Impact on production',
  failureMode: 'Failure mode',
  quantity: 'Quantity',
  quantityUom: 'Quantity unit',
};

export interface SourceOwnership {
  /** the source in words ("PI", "MQTT"), never empty */
  source: string;
  /** true: start, end and duration belong to the source (read only) */
  intervalOwned: boolean;
  /** owned fields whose edit is recorded as a source override */
  overridable: ReadonlySet<string>;
}

/**
 * Marun E2E 1.5: the data source of an event (never its cause origin, which is the unit / asset "Origin"):
 * the source in words beside how it was recorded ("State engine · Derived"); a manual event says so.
 */
export function eventSourceText(event: Pick<ProductionEventView, 'source' | 'sourceKind'>, kindLabel: string): string {
  const source = event.source?.trim();
  return event.sourceKind === 'manual' || !source ? kindLabel : `${source} · ${kindLabel}`;
}

/** Where a source event comes from, in words. */
export function sourceNameOf(event: Pick<ProductionEventView, 'source'>): string {
  return event.source?.trim() || 'the source system';
}

/**
 * E-5: what the source owns of an event, from the server's `sourceOwnedFields` (the UI never decides):
 * the interval (refused on edit) and the overridable fields (an edit is recorded as an override).
 * No event (create) or an older server without the list: nothing is owned.
 */
export function sourceOwnershipOf(event: Pick<ProductionEventView, 'source' | 'sourceOwnedFields'> | null): SourceOwnership {
  const owned = event?.sourceOwnedFields ?? [];
  return {
    source: event ? sourceNameOf(event) : '',
    intervalOwned: owned.some((field) => SOURCE_INTERVAL_FIELDS.includes(field)),
    overridable: new Set(owned.filter((field) => !SOURCE_INTERVAL_FIELDS.includes(field))),
  };
}

/** The given fields the source owns as overridable, in their order. */
export function ownedFieldsOf(ownership: SourceOwnership, fields: readonly string[]): string[] {
  return fields.filter((field) => ownership.overridable.has(field));
}

/**
 * A PATCH body without the interval when the source owns it: the form shows it read only, so a value left
 * in an older draft is not sent (the server would refuse the whole save with 409 SOURCE_OWNED).
 */
export function withoutSourceInterval<T extends object>(changes: T, ownership: Pick<SourceOwnership, 'intervalOwned'>): T {
  if (!ownership.intervalOwned) return changes;
  return Object.fromEntries(Object.entries(changes).filter(([field]) => !SOURCE_INTERVAL_FIELDS.includes(field))) as T;
}
