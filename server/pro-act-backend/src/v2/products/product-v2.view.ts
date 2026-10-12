import { Product } from '../../product/product.entity';
import { toDecimalString } from '../common/decimal-string.transformer';

/** Who can use a product: every plant of the organisation, or one plant only. */
export type ProductAvailability = 'organization' | 'plant';

/**
 * `GET /api/v2/products` item and `GET /api/v2/products/{id}`: what a product picker needs (plan 3.4) plus
 * the master data the v2 master-data screens edit. `legacyStandardCost` (single reads only, never in lists
 * or pickers) is the v1 `standard_rate`, an unconfirmed legacy cost (D08 Q3) no v2 calculation reads.
 */
export interface ProductV2View {
  id: string;
  code: string;
  name: string;
  /** v1 unit of measure of the product, if any (profiles carry their own quantity unit) */
  uom: string | null;
  isActive: boolean;
  description: string | null;
  /** organisation = shared by every plant of the organisation (no plant); plant = the acting plant only */
  availability: ProductAvailability;
  /** `GET /products/{id}` only; decimal string, unconfirmed legacy cost, not used by v2 calculations */
  legacyStandardCost?: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toProductView(
  product: Product,
  withLegacyCost = false,
): ProductV2View {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    uom: product.unitOfMeasure ?? null,
    isActive: product.isActive,
    description: product.description ?? null,
    availability: product.tenantId ? 'plant' : 'organization',
    ...(withLegacyCost
      ? { legacyStandardCost: toDecimalString(product.standardCost) }
      : {}),
    rowVersion: product.rowVersion,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
