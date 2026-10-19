import { useAllCodes } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Badge } from '@/components/ui/badge';
import { reasonCodeLabel } from '@/features/ux-kit/reason-code-picker/reason-code-options';

export interface LineCodesProps {
  reasonCodeId: string | null | undefined;
  /** omitted for lines that carry no impact code (manual lines) */
  impactCodeId?: string | null;
  showImpact?: boolean;
  /**
   * default true: an uncoded line shows the amber "Not coded" chip. False for a line no stop caused (a
   * disposition-based quality line): there is nothing to code, so no coding backlog is suggested.
   */
  flagUncoded?: boolean;
}

/** Name of a code of the library (retired codes keep their name); "loading…" while the library loads. */
function useCodeName(library: 'reason-codes' | 'impact-codes', id: string | null | undefined): string | null {
  // retired codes too: a line coded before the code was retired keeps its name (FE-05)
  const codes = useAllCodes(library, { includeRetired: true });
  if (!id) return null;
  return reasonCodeLabel(flattenPages(codes.data?.pages), id) ?? (codes.complete || codes.isError ? 'Unknown code' : 'loading…');
}

/** The reason (and impact) code of a loss line by name, or an amber "Not coded" chip in words. */
export function LineCodes({ reasonCodeId, impactCodeId = null, showImpact = false, flagUncoded = true }: LineCodesProps) {
  const reason = useCodeName('reason-codes', reasonCodeId);
  const impact = useCodeName('impact-codes', impactCodeId);
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs" data-testid="line-codes">
      {reason ? (
        <span data-testid="line-reason-code">Reason: {reason}</span>
      ) : !flagUncoded ? null : (
        <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning" data-testid="line-not-coded">
          Not coded
        </Badge>
      )}
      {showImpact && impact && <span data-testid="line-impact-code">· Impact: {impact}</span>}
    </span>
  );
}
