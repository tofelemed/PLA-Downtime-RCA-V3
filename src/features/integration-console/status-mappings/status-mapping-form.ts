import type { SourceStatusEntry, SourceStatusMappingCreateBody, SourceStatusMappingView } from '@/api/v2/types/status-mappings';

/** The draft form of a source status mapping version (SME R13). */
export interface StatusMappingFormValues {
  sourceSystem: string;
  /** ISO UTC instant from the plant-time input, or null */
  effectiveFrom: string | null;
  statuses: SourceStatusEntry[];
  notes: string;
}

export type StatusMappingFieldErrors = Partial<Record<'sourceSystem' | 'effectiveFrom' | 'statuses', string>>;

/** The server's source system pattern (`source-status-mappings-v2.controller.ts`). */
const SOURCE_SYSTEM = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** A new version starts from the source's newest version (its statuses), or from one empty row. */
export function initialMappingForm(source: SourceStatusMappingView | null): StatusMappingFormValues {
  return {
    sourceSystem: source?.sourceSystem ?? '',
    effectiveFrom: null,
    statuses: source ? source.statuses.map((s) => ({ ...s })) : [{ status: '', released: false }],
    notes: '',
  };
}

/** Field checks before sending (the server validates again and decides overlaps and roles). */
export function validateMappingForm(values: StatusMappingFormValues): StatusMappingFieldErrors {
  const errors: StatusMappingFieldErrors = {};
  if (!SOURCE_SYSTEM.test(values.sourceSystem.trim())) errors.sourceSystem = 'Letters, digits, dot, dash or underscore (up to 64), e.g. lims';
  if (!values.effectiveFrom) errors.effectiveFrom = 'Choose when the version applies from';
  const named = values.statuses.filter((s) => s.status.trim());
  if (named.length === 0) errors.statuses = 'Add at least one source status';
  else if (named.length > 100) errors.statuses = 'At most 100 statuses';
  else if (named.some((s) => s.status.trim().length > 64)) errors.statuses = 'A status has at most 64 characters';
  return errors;
}

/** The create body: blank rows dropped, only declared fields (forbidNonWhitelisted). */
export function mappingCreateBody(values: StatusMappingFormValues): SourceStatusMappingCreateBody {
  const notes = values.notes.trim();
  return {
    sourceSystem: values.sourceSystem.trim(),
    effectiveFrom: values.effectiveFrom ?? '',
    statuses: values.statuses.filter((s) => s.status.trim()).map((s) => ({ status: s.status.trim(), released: s.released })),
    ...(notes ? { notes } : {}),
  };
}

/** Versions grouped by source system, in the server's order (newest version first). */
export function groupBySource(items: readonly SourceStatusMappingView[]): Array<{ sourceSystem: string; versions: SourceStatusMappingView[] }> {
  const groups = new Map<string, SourceStatusMappingView[]>();
  for (const item of items) {
    const list = groups.get(item.sourceSystem) ?? [];
    list.push(item);
    groups.set(item.sourceSystem, list);
  }
  return [...groups.entries()].map(([sourceSystem, versions]) => ({ sourceSystem, versions }));
}
