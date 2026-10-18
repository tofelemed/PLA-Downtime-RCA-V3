import type { ProductionEventView } from '@/api/v2/types/events';

/**
 * SME E3: the quality-loss inputs of the event form — the off-spec quantity with its unit and what
 * happened to it (downgrade sold at a discount, scrap, rework). Output and measured slowdown also carry quantities; only quality loss carries a disposition.
 */
export const QUALITY_FIELDS = ['quantity', 'quantityUom', 'dispositionClass'] as const;
export type QualityField = (typeof QUALITY_FIELDS)[number];
export type QualityValues = Record<QualityField, string>;

export const EMPTY_QUALITY: QualityValues = { quantity: '', quantityUom: '', dispositionClass: '' };

export function qualityValuesOf(event: ProductionEventView): QualityValues {
  return {
    quantity: event.quantity ?? '',
    quantityUom: event.quantityUom ?? '',
    dispositionClass: event.dispositionClass ?? '',
  };
}

const hasQuantity = (physicalType: string) => ['quality_loss', 'production_output', 'slowdown'].includes(physicalType);
const isQuality = (physicalType: string) => physicalType === 'quality_loss';

/** Quantity fields for output, slowdown and quality loss; disposition is restricted to quality loss. */
export function qualityCreateFields(values: QualityValues & { physicalType: string }): Partial<QualityValues> {
  if (!hasQuantity(values.physicalType)) return {};
  const body: Partial<QualityValues> = {};
  for (const field of QUALITY_FIELDS) {
    if (field === 'dispositionClass' && !isQuality(values.physicalType)) continue;
    const value = values[field].trim();
    if (value) body[field] = value;
  }
  return body;
}

/** The changed quality fields of a PATCH body; an emptied field is cleared with null; a type change away clears the class. */
export function qualityPatchFields(
  initial: QualityValues,
  values: QualityValues & { physicalType: string },
): Partial<Record<QualityField, string | null>> {
  const changes: Partial<Record<QualityField, string | null>> = {};
  if (!hasQuantity(values.physicalType)) {
    if (initial.dispositionClass) changes.dispositionClass = null;
    return changes;
  }
  for (const field of QUALITY_FIELDS) {
    if (field === 'dispositionClass' && !isQuality(values.physicalType)) {
      if (initial.dispositionClass) changes.dispositionClass = null;
      continue;
    }
    if (values[field] !== initial[field]) changes[field] = values[field].trim() || null;
  }
  return changes;
}
