import type { MasterProductView, ProductAvailability } from '../api/master-data-types';
import { optionalDecimal, requiredText, textOrNull, type FieldErrors } from '../model/field-errors';

export interface ProductDraft {
  code: string;
  name: string;
  uom: string;
  description: string;
  availability: ProductAvailability;
  legacyStandardCost: string;
}

export interface ProductChangeBody {
  code: string;
  name: string;
  uom: string | null;
  description: string | null;
  legacyStandardCost: string | null;
}

export interface ProductCreateBody extends ProductChangeBody {
  availability: ProductAvailability;
}

export function productDraftOf(product: MasterProductView | null): ProductDraft {
  return {
    code: product?.code ?? '',
    name: product?.name ?? '',
    uom: product?.uom ?? '',
    description: product?.description ?? '',
    availability: product?.availability ?? 'organization',
    legacyStandardCost: product?.legacyStandardCost ?? '',
  };
}

export function validateProduct(draft: ProductDraft): FieldErrors {
  return {
    name: requiredText(draft.name, 'Name'),
    code: requiredText(draft.code, 'Code'),
    legacyStandardCost: optionalDecimal(draft.legacyStandardCost, 'Standard cost'),
  };
}

export function productChangeOf(draft: ProductDraft): ProductChangeBody {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    uom: textOrNull(draft.uom),
    description: textOrNull(draft.description),
    legacyStandardCost: textOrNull(draft.legacyStandardCost),
  };
}

export function productCreateOf(draft: ProductDraft): ProductCreateBody {
  return { ...productChangeOf(draft), availability: draft.availability };
}
