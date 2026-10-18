import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import { useSaveRcaAnalysis } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaAnalysesView, RcaAnalysisBodies, RcaRecordTool } from '@/api/v2/types/rca-analyses';
import { useCaseWorkspace } from '../../case-context';

export type ToolRecord<K extends RcaRecordTool> = RcaAnalysesView[K];

/**
 * The saved record of one tool and its save command. The save sends If-Match = the version the editor
 * was opened on (`null` = first save, none sent), so a save in between is refused instead of overwritten.
 */
export function useToolRecord<K extends RcaRecordTool>(tool: K) {
  const { rca } = useCaseWorkspace();
  const analyses = useRcaAnalyses(rca.id);
  const command = useSaveRcaAnalysis<K>();
  const record = (analyses.data?.[tool] ?? null) as ToolRecord<K>;
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const save = async (body: RcaAnalysisBodies[K], rowVersion: number | null) => {
    const saved = await command.submit({ rcaId: rca.id, tool, body, rowVersion });
    const key = v2Keys.detail(tenantId ?? '-', 'rca-cases', rca.id, 'analyses');
    client.setQueryData<RcaAnalysesView>(key, (current) => (current ? { ...current, [tool]: saved } : current));
    return saved;
  };
  return { analyses, record, save, error: command.error, isPending: command.isPending };
}
