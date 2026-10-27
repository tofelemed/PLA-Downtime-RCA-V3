import {
  CODING_STATE_LABELS,
  EVENT_FIELD_LABELS,
  EVENT_RCA_STATE_LABELS,
  humanize,
  IMPACT_MODE_LABELS,
  labelOf,
  looksLikeRawId,
  OEE_COMPONENT_LABELS,
  PHYSICAL_STATE_LABELS,
  PHYSICAL_TYPE_LABELS,
  SCHEDULE_CLASS_LABELS,
  SOURCE_KIND_LABELS,
} from '@/features/ux-kit/labels';
import type { DeclaredFigures } from '@/api/v2/types/events';
import { declaredFiguresText } from './production-loss';
import { EVENT_TYPE_LABELS, FAILURE_SEVERITY_LABELS } from '@/features/ux-kit/labels/event-hub-labels';

/**
 * Display of revision facts (`effectiveFacts` / `sourceFacts`, ING06): every field gets its label and
 * every value a readable form — names for ids, plant time for instants, labels for enum tokens. A value
 * that is still an internal id is never shown (UI guidelines §5).
 */
export interface FactResolvers {
  unitName: (id: string) => string;
  assetName: (id: string) => string;
  reasonName: (id: string) => string;
  impactName: (id: string) => string;
  userName: (id: string) => string;
  dateTime: (iso: string) => string;
  /** seconds as `1 h 30 min` in the plant's digits */
  duration: (seconds: number) => string;
  /**
   * QA audit F4: the failure dictionary's name of a coded failure field (`TRIP_ALARM` → "Trip alarm"); null
   * when the plant has no such code (free text is shown as typed)
   */
  failureName?: (field: string, code: string) => string | null;
  /** a decimal string in the plant's digits (declared tonnes); without it the declared figures show as a plain list */
  decimal?: (value: string, fractionDigits: number) => string;
}

type Resolver = (value: string, r: FactResolvers) => string;

const ENUM_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  physicalType: PHYSICAL_TYPE_LABELS,
  scheduleClass: SCHEDULE_CLASS_LABELS,
  oeeComponent: OEE_COMPONENT_LABELS,
  impactMode: IMPACT_MODE_LABELS,
  codingState: CODING_STATE_LABELS,
  physicalState: PHYSICAL_STATE_LABELS,
  rcaState: EVENT_RCA_STATE_LABELS,
  sourceKind: SOURCE_KIND_LABELS,
  eventType: EVENT_TYPE_LABELS,
  apmType: EVENT_TYPE_LABELS,
  failureSeverity: FAILURE_SEVERITY_LABELS,
};

/** Coded failure fields whose values are failure-dictionary codes (SME D11); free text is shown as typed. */
const FAILURE_CODE_FIELDS = ['failureMode', 'failureMechanism', 'failureCause', 'detectionMethod', 'maintainableItem'] as const;

/**
 * Field names this page words differently from the shared list (QA audit F4 / L12: two rows read "Event type";
 * docs/GLOSSARY.md: an RCA is an "investigation").
 */
const LOCAL_FIELD_LABELS: Readonly<Record<string, string>> = {
  apmType: 'APM alert type',
  solType: 'Safe operating limit type',
  rcaState: 'Investigation state',
  rcaId: 'Investigation',
};

const ID_RESOLVERS: Readonly<Record<string, Resolver>> = {
  unitId: (v, r) => r.unitName(v),
  assetId: (v, r) => r.assetName(v),
  reasonCodeId: (v, r) => r.reasonName(v),
  impactCodeId: (v, r) => r.impactName(v),
  createdBy: (v, r) => r.userName(v),
  updatedBy: (v, r) => r.userName(v),
  userId: (v, r) => r.userName(v),
  ...Object.fromEntries(FAILURE_CODE_FIELDS.map((field): [string, Resolver] => [field, (v, r) => r.failureName?.(field, v) ?? v])),
};

const TIME_FIELDS: ReadonlySet<string> = new Set(['startTime', 'endTime', 'createdAt', 'updatedAt', 'retractedAt']);
const DURATION_FIELDS: ReadonlySet<string> = new Set(['durationSeconds', 'breachDuration', 'elapsedSeconds']);

/** Label of a fact field (`reasonCodeId` → "Reason"). */
export function factLabel(field: string): string {
  return LOCAL_FIELD_LABELS[field] ?? EVENT_FIELD_LABELS[field] ?? humanize(field);
}

function scalarText(field: string, value: string | number | boolean, r: FactResolvers): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (DURATION_FIELDS.has(field)) return r.duration(Number(value));
  const text = String(value);
  if (ID_RESOLVERS[field]) return ID_RESOLVERS[field](text, r);
  if (TIME_FIELDS.has(field)) return r.dateTime(text);
  if (ENUM_LABELS[field]) return labelOf(ENUM_LABELS[field], text);
  return looksLikeRawId(text) ? 'Linked record' : text;
}

function objectText(value: object, r: FactResolvers): string {
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '—';
  return entries
    .map(([key, inner]) => `${factLabel(key)}: ${inner !== null && typeof inner === 'object' ? '…' : factText(key, inner, r)}`)
    .join(' · ');
}

function isDeclaredFigures(value: unknown): value is DeclaredFigures {
  return typeof value === 'object' && value !== null && typeof (value as DeclaredFigures).shortfall === 'number' && typeof (value as DeclaredFigures).uom === 'string';
}

/** Readable text of one fact value. */
export function factText(field: string, value: unknown, r: FactResolvers): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'declaredFigures' && isDeclaredFigures(value)) return declaredFiguresText(value, r.decimal ?? ((v) => v));
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map((item) => factText(field, item, r)).join(', ');
  if (typeof value === 'object') return objectText(value, r);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return scalarText(field, value, r);
  return '—';
}
