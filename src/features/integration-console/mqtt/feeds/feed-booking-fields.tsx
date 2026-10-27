import { useEffect } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import type { FeedForm, FeedProblems } from '../model/feeds';

interface FeedBookingFieldsProps {
  feed: FeedForm;
  errors: FeedProblems;
  readOnly: boolean;
  onChange: (patch: Partial<FeedForm>) => void;
}

type List = ReturnType<typeof useUnits> | ReturnType<typeof useProducts>;

/** Follow later pages of a picker list (master data lists are small; the pickers need all of it). */
function useAllPages(list: List) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}

/** PLA feed: the unit and product the plant-day actual is booked to. */
export function FeedBookingFields({ feed, errors, readOnly, onChange }: FeedBookingFieldsProps) {
  const units = useUnits();
  const products = useProducts();
  useAllPages(units);
  useAllPages(products);
  const unitOptions = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: `${unit.code} — ${unit.name}` }));
  const productOptions = flattenPages(products.data?.pages)
    .filter((product) => product.isActive || product.id === feed.productId)
    .map((product) => ({ value: product.id, label: `${product.code} — ${product.name}` }));
  return (
    <>
      <Field id={`feed-${feed.id}-unit`} label="Book to unit" required error={errors.unitId} hint="The daily actual is booked to this unit.">
        <NativeSelect id={`feed-${feed.id}-unit`} testId="feed-unit" value={feed.unitId} placeholder={units.isLoading ? 'Loading units…' : 'Choose a unit'} options={unitOptions} disabled={readOnly} onChange={(unitId) => onChange({ unitId })} />
      </Field>
      <Field id={`feed-${feed.id}-product`} label="Product" required error={errors.productId}>
        <NativeSelect id={`feed-${feed.id}-product`} testId="feed-product" value={feed.productId} placeholder={products.isLoading ? 'Loading products…' : 'Choose a product'} options={productOptions} disabled={readOnly} onChange={(productId) => onChange({ productId })} />
      </Field>
    </>
  );
}
