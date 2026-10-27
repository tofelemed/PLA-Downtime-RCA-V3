import { useMemo } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { LossAccountingPolicyView } from '@/api/v2/types/loss-accounting';
import { lossAccountingSummary } from './loss-accounting-model';
import { useUnitNames } from './use-unit-names';

/** The one-line summary of a policy with the unit and product named (both lists are cached by the query layer). */
export function useLossAccountingSummary(): (policy: LossAccountingPolicyView) => string {
  const unitName = useUnitNames();
  const products = useProducts();
  const pages = products.data?.pages;
  const productById = useMemo(() => new Map(flattenPages(pages).map((product) => [product.id, product.name])), [pages]);
  return (policy) => lossAccountingSummary(policy, unitName(policy.accountingUnitId), policy.accountingProductId ? productById.get(policy.accountingProductId) : undefined);
}
