import { Product } from '../../product/product.entity';

/**
 * `GET /api/v2/products` item: what a product picker needs (plan 3.4). The v1 `standard_rate` is not
 * exposed — it is an unconfirmed legacy cost (D08 Q3) shown only on seeded profiles (`legacy`).
 */
export interface ProductV2View {
  id: string;
  code: string;
  name: string;
  /** v1 unit of measure of the product, if any (profiles carry their own quantity unit) */
  uom: string | null;
  isActive: boolean;
}

export function toProductView(product: Product): ProductV2View {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    uom: product.unitOfMeasure ?? null,
    isActive: product.isActive,
  };
}
