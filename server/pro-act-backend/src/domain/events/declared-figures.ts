import { Dec } from '../actuals/decimal';

/**
 * Declared mode: the figures an OT system declares for a production loss event (planned, actual and the
 * shortfall between them, in the event's unit of measure) with their provenance. The shortfall is the
 * event's quantity; the identity `planned − actual = shortfall` is checked, never forced.
 */
export interface DeclaredFigures {
  planned: number | null;
  actual: number | null;
  shortfall: number;
  uom: string;
  measurementQuality: string | null;
  /** OT status, e.g. 'DETECTED' | 'CONFIRMED' */
  sourceStatus: string | null;
  plan: {
    source: string | null;
    planId: string | null;
    revision: number | null;
    approved: boolean | null;
  } | null;
  piSource: { actualTag: string | null; eventFrameId: string | null } | null;
}

export const DECLARED_CONFIRMED_STATUS = 'CONFIRMED';
export const DECLARED_DEFAULT_UOM = 't';

/** Scale of the declared figures (the DTO's 8 places): binary float noise below it is no gap. */
const GAP_SCALE = 8;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parsePlan(raw: unknown): DeclaredFigures['plan'] {
  if (!isRecord(raw)) return null;
  return {
    source: textOrNull(raw.source),
    planId: textOrNull(raw.planId),
    revision: numberOrNull(raw.revision),
    approved: booleanOrNull(raw.approved),
  };
}

function parsePiSource(raw: unknown): DeclaredFigures['piSource'] {
  if (!isRecord(raw)) return null;
  return {
    actualTag: textOrNull(raw.actualTag),
    eventFrameId: textOrNull(raw.eventFrameId),
  };
}

/** Typed figures from a stored or delivered value (numeric strings accepted); null when unreadable or no shortfall. */
export function parseDeclaredFigures(raw: unknown): DeclaredFigures | null {
  const value = typeof raw === 'string' ? parseJson(raw) : raw;
  if (!isRecord(value)) return null;
  const shortfall = numberOrNull(value.shortfall);
  if (shortfall === null) return null;
  return {
    planned: numberOrNull(value.planned),
    actual: numberOrNull(value.actual),
    shortfall,
    uom: textOrNull(value.uom) ?? DECLARED_DEFAULT_UOM,
    measurementQuality: textOrNull(value.measurementQuality),
    sourceStatus: textOrNull(value.sourceStatus),
    plan: parsePlan(value.plan),
    piSource: parsePiSource(value.piSource),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** `planned − actual − shortfall` when both planned and actual are declared, else 0 (nothing to check). */
export function declaredIdentityGap(figures: DeclaredFigures): number {
  if (figures.planned === null || figures.actual === null) return 0;
  return new Dec(figures.planned)
    .minus(figures.actual)
    .minus(figures.shortfall)
    .toDecimalPlaces(GAP_SCALE)
    .toNumber();
}

/** True when the OT system confirmed the figures (the day's accounting waits for this). */
export function isDeclaredConfirmed(figures: DeclaredFigures | null): boolean {
  return figures?.sourceStatus === DECLARED_CONFIRMED_STATUS;
}
