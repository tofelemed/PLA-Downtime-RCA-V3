import { useCodeList } from '@/api/v2/queries/codes-admin';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnits } from '@/api/v2/queries/units';
import type { RuleReference } from '@/api/v2/types/rules';

export interface Option {
  value: string;
  label: string;
}

/**
 * Picker options for reference fields of a rule (tenant records by id). Assets have no v2 list yet,
 * so they map to `null` (the builder asks for the asset id; the server checks it, 422 INVALID_REFERENCE).
 */
export function useReferenceOptions(): Record<RuleReference, Option[] | null> {
  const units = useUnits();
  const reasons = useCodeList('reason-codes', {});
  const impacts = useCodeList('impact-codes', {});
  const label = (code: { code: string; name: string }) => `${code.code} — ${code.name}`;
  return {
    unit: flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name })),
    reason_code: reasons.items.filter((code) => code.active).map((code) => ({ value: code.id, label: label(code) })),
    impact_code: impacts.items.filter((code) => code.active).map((code) => ({ value: code.id, label: label(code) })),
    asset: null,
  };
}
