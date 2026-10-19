import { EntityManager } from 'typeorm';
import { defaultSiteOf } from '../../close/close-calendar';
import { plantIso } from '../../exports/export-words';
import { CsvValue } from '../../exports/csv';
import { ProductionEvent } from '../../production-event/production-event.entity';

/**
 * The words people read in the event CSV (QA audit L5): the raw keys stay in their own columns for machines,
 * and these columns add the plant-clock times and the screen labels (the Event Hub's wording; docs/GLOSSARY.md:
 * an RCA is an "investigation"). Appended after the existing columns, so earlier readers keep working.
 */
export const EXPORT_LABEL_COLUMNS = [
  'start_plant',
  'end_plant',
  'event_type_label',
  'physical_type_label',
  'schedule_class_label',
  'oee_component_label',
  'physical_state_label',
  'coding_state_label',
  'rca_state_label',
  'source_kind_label',
] as const;

type Labels = Readonly<Record<string, string>>;

const EVENT_TYPE: Labels = {
  ProductionLoss: 'Production loss',
  IOW: 'Integrity operating window',
  SOL: 'Safe operating limit',
  APM: 'Asset performance alert',
  FailureWO: 'Failure work order',
  ProductionOutput: 'Production output',
};
const PHYSICAL_TYPE: Labels = {
  downtime: 'Downtime',
  slowdown: 'Slowdown',
  quality_loss: 'Quality loss',
  production_output: 'Production output',
  advisory: 'Advisory',
  grade_transition: 'Grade transition',
};
const SCHEDULE_CLASS: Labels = {
  planned: 'Planned',
  unplanned: 'Unplanned',
  external: 'External',
  unknown: 'Unknown',
};
const OEE_COMPONENT: Labels = {
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  idle: 'Idle (not counted)',
  none: 'Not an OEE loss',
};
const PHYSICAL_STATE: Labels = {
  open: 'Ongoing',
  closed: 'Ended',
  superseded: 'Superseded',
  retracted: 'Retracted',
};
const CODING_STATE: Labels = {
  uncoded: 'Uncoded',
  coded: 'Coded',
  reviewed: 'Reviewed',
};
const RCA_STATE: Labels = {
  none: 'No investigation',
  required: 'Investigation required',
  linked: 'Investigation linked',
  completed: 'Investigation completed',
};
const SOURCE_KIND: Labels = {
  manual: 'Entered manually',
  source: 'From a connected source',
  derived: 'Derived',
  imported: 'Imported',
};

/** `some_key` → `Some key` when a key has no label yet (never the raw key with underscores). */
function labelOf(
  labels: Labels,
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  const words = key.replace(/_/g, ' ').trim();
  return labels[key] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

/** The plant clock of the export: the default site's (published calendar) zone, else the plant's own. */
export async function exportTimezoneOf(
  manager: EntityManager,
  tenantId: string,
): Promise<string | null> {
  const site = await defaultSiteOf(manager, tenantId);
  if (site?.timezone) return site.timezone;
  const rows: Array<{ timezone: string | null }> = await manager.query(
    `SELECT "timezone" FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  return rows[0]?.timezone ?? null;
}

/** The appended cells of one event, in `EXPORT_LABEL_COLUMNS` order. */
export function labelCells(
  event: ProductionEvent,
  timezone: string | null,
): CsvValue[] {
  const iso = (value: Date | string | null | undefined) =>
    value ? new Date(value).toISOString() : null;
  return [
    plantIso(iso(event.startTime), timezone),
    plantIso(iso(event.endTime), timezone),
    labelOf(EVENT_TYPE, event.eventType),
    labelOf(PHYSICAL_TYPE, event.physicalType),
    labelOf(SCHEDULE_CLASS, event.scheduleClass),
    labelOf(OEE_COMPONENT, event.oeeComponent),
    labelOf(PHYSICAL_STATE, event.physicalState),
    labelOf(CODING_STATE, event.codingState),
    labelOf(RCA_STATE, event.rcaState),
    labelOf(SOURCE_KIND, event.sourceKind),
  ];
}
