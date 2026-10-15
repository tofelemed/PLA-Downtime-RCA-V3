import type { SourceAuthorityDraftBody, SourceAuthorityPolicyView } from '@/api/v2/types/source-authority';
import { ACTUALS_SOURCE_LABELS } from '@/features/plan-dashboard/model/actuals-labels';

/** Server enums (`domain/actuals/period/period-actuals.types.ts`); the server checks every combination. */
export const SOURCE_CLASS_OPTIONS = [
  { value: 'calibrated_primary', label: 'Calibrated primary totalizer' },
  { value: 'redundant_measurement', label: 'Redundant measurement' },
  { value: 'reconciled_record', label: 'Reconciled production / inventory record' },
  { value: 'approved_estimate', label: 'Approved estimate (manual)' },
] as const;

export const SOURCE_OPTIONS = ['pi_counter', 'pi_output_ef', 'pi_rate', 'mqtt', 'kafka', 'manual', 'external_report'].map((value) => ({
  value,
  label: ACTUALS_SOURCE_LABELS[value] ?? value,
}));

export const FALLBACK_CONDITIONS = [
  { value: 'primary_missing', label: 'Missing' },
  { value: 'primary_stale', label: 'Stale' },
  { value: 'primary_bad_quality', label: 'Incomplete / bad quality' },
  { value: 'primary_conflict', label: 'In conflict with another source' },
] as const;

/** The server's boundary pattern (`source-authority-v2.dto.ts`). */
const BOUNDARY = /^[A-Za-z0-9_.-]{1,64}$/;

export interface EntryValues {
  sourceClass: string;
  source: string;
  signalSourceKey: string;
  boundary: string;
  /** the record is at another boundary and is brought to the slice boundary */
  crossBoundary: boolean;
  inventoryChangeAccounted: boolean;
  lagSeconds: string;
  evidenceRef: string;
}

export interface HierarchyFormValues {
  /** 'unit' = an override of the chosen unit, 'plant' = the plant-wide version */
  scope: 'unit' | 'plant';
  boundary: string;
  conditions: string[];
  entries: EntryValues[];
  notes: string;
}

export type HierarchyFieldErrors = Partial<Record<'boundary' | 'conditions' | 'entries', string>> & { entry?: Record<number, string> };

export function emptyEntry(boundary: string): EntryValues {
  return { sourceClass: 'calibrated_primary', source: 'pi_counter', signalSourceKey: '', boundary, crossBoundary: false, inventoryChangeAccounted: false, lagSeconds: '0', evidenceRef: '' };
}

/** The form starts from the version in force: its hierarchy, or its primary source as rank 1. */
export function initialHierarchyForm(policy: SourceAuthorityPolicyView | null, scope: 'unit' | 'plant'): HierarchyFormValues {
  const hierarchy = policy?.measurementHierarchy;
  if (!hierarchy) {
    const first = { ...emptyEntry(''), source: policy?.primarySource ?? 'pi_counter' };
    return { scope, boundary: '', conditions: ['primary_missing'], entries: [first], notes: '' };
  }
  const entries = [...hierarchy.entries]
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => ({
      sourceClass: entry.sourceClass ?? 'calibrated_primary',
      source: entry.source,
      signalSourceKey: entry.signalSourceKey ?? '',
      boundary: entry.boundary ?? hierarchy.boundary,
      crossBoundary: Boolean(entry.boundaryAdjustment),
      inventoryChangeAccounted: entry.boundaryAdjustment?.inventoryChangeAccounted ?? false,
      lagSeconds: String(entry.boundaryAdjustment?.lagSeconds ?? 0),
      evidenceRef: entry.boundaryAdjustment?.evidenceRef ?? '',
    }));
  return { scope, boundary: hierarchy.boundary, conditions: [...hierarchy.conditions], entries, notes: '' };
}

function entryError(entry: EntryValues): string | null {
  if (!BOUNDARY.test(entry.boundary)) return 'Enter the boundary of this source (letters, digits, _ . -)';
  if (!entry.crossBoundary) return null;
  if (!/^\d+$/.test(entry.lagSeconds)) return 'The lag is a whole number of seconds';
  return entry.evidenceRef.trim() ? null : 'Enter the evidence for the boundary adjustment';
}

/** Only what the request needs to be well-formed; ranks, classes and boundaries are the server's rules. */
export function validateHierarchyForm(values: HierarchyFormValues): HierarchyFieldErrors {
  const errors: HierarchyFieldErrors = {};
  if (!BOUNDARY.test(values.boundary)) errors.boundary = 'Enter the measurement boundary (letters, digits, _ . -)';
  if (values.entries.length === 0) errors.entries = 'Add at least one source';
  if (values.entries.length > 10) errors.entries = 'At most 10 sources';
  const entry: Record<number, string> = {};
  values.entries.forEach((e, index) => {
    const message = entryError(e);
    if (message) entry[index] = message;
  });
  if (Object.keys(entry).length > 0) errors.entry = entry;
  return errors;
}

/** The request body: ranks follow the order on screen (1 = best). */
export function hierarchyDraftBody(values: HierarchyFormValues, unitId: string | null): SourceAuthorityDraftBody {
  const notes = values.notes.trim();
  return {
    ...(values.scope === 'unit' && unitId ? { unitId } : {}),
    measurementHierarchy: {
      boundary: values.boundary,
      conditions: values.conditions,
      entries: values.entries.map((entry, index) => ({
        rank: index + 1,
        sourceClass: entry.sourceClass,
        source: entry.source,
        signalSourceKey: entry.signalSourceKey.trim() || null,
        boundary: entry.boundary,
        boundaryAdjustment: entry.crossBoundary
          ? { inventoryChangeAccounted: entry.inventoryChangeAccounted, lagSeconds: Number(entry.lagSeconds), evidenceRef: entry.evidenceRef.trim() }
          : null,
      })),
    },
    ...(notes ? { notes } : {}),
  };
}
