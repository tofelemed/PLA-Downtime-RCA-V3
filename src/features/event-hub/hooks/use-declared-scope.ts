import { useLossAccountingMode } from '@/features/accounting-mode/use-loss-accounting-mode';

/** True when the one unit chosen in the filters (else the plant-wide policy) accounts losses in declared mode. */
export function useDeclaredScope(unitIds: readonly string[]): boolean {
  return useLossAccountingMode(unitIds.length === 1 ? unitIds[0] : undefined).isDeclared;
}
