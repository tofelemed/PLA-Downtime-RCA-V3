import { useAllCodes } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { reasonCodeLabel } from '@/features/ux-kit/reason-code-picker/reason-code-options';

/** Reason code names (retired ones too) as a resolver: null → "none", unknown → "Unknown code" / "loading…". */
export function useReasonCodeName(): (id: string | null) => string {
  const codes = useAllCodes('reason-codes', { includeRetired: true });
  const items = flattenPages(codes.data?.pages);
  return (id) => {
    if (!id) return 'none';
    return reasonCodeLabel(items, id) ?? (codes.complete || codes.isError ? 'Unknown code' : 'loading…');
  };
}
