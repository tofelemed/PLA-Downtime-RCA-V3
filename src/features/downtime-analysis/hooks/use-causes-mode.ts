import { useSearchParams } from 'react-router-dom';
import { useLossAccountingMode } from '@/features/accounting-mode/use-loss-accounting-mode';

/**
 * The "Rank by" analysis of the causes page. A plant that accounts declared losses has no lost production on
 * its stops, so without a choice in the URL it opens on the downtime reasons.
 */
export function useCausesMode(unitId?: string): { mode: string | null; fallback: string | undefined } {
  const [params] = useSearchParams();
  const { isDeclared } = useLossAccountingMode(unitId);
  const fallback = isDeclared ? 'reasons' : undefined;
  return { mode: params.get('analysis') ?? fallback ?? null, fallback };
}
