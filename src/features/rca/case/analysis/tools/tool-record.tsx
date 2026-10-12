import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import { useSaveRcaAnalysis } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaAnalysesView, RcaAnalysisBodies, RcaRecordTool } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useRcaFormat } from '../../../use-rca-format';
import { useCaseWorkspace } from '../../case-context';

export type ToolRecord<K extends RcaRecordTool> = RcaAnalysesView[K];

/** The saved record of one tool and its save command (first save without If-Match, later with it). */
export function useToolRecord<K extends RcaRecordTool>(tool: K) {
  const { rca } = useCaseWorkspace();
  const analyses = useRcaAnalyses(rca.id);
  const command = useSaveRcaAnalysis<K>();
  const record = (analyses.data?.[tool] ?? null) as ToolRecord<K>;
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const save = async (body: RcaAnalysisBodies[K]) => {
    const saved = await command.submit({ rcaId: rca.id, tool, body, rowVersion: record ? record.rowVersion : null });
    const key = v2Keys.detail(tenantId ?? '-', 'rca-cases', rca.id, 'analyses');
    client.setQueryData<RcaAnalysesView>(key, (current) => (current ? { ...current, [tool]: saved } : current));
    return saved;
  };
  return { analyses, record, save, error: command.error, isPending: command.isPending };
}

export interface ToolFrameProps<K extends RcaRecordTool> {
  tool: K;
  /** the editor, mounted once the record is loaded (and again after someone else's save) */
  children: (record: ToolRecord<K>, save: (body: RcaAnalysisBodies[K]) => Promise<unknown>) => ReactNode;
}

/** Loads the tool's record, then renders the editor with it. */
export function ToolFrame<K extends RcaRecordTool>({ tool, children }: ToolFrameProps<K>) {
  const { analyses, record, save } = useToolRecord(tool);
  const { readOnly } = useCaseWorkspace();
  return (
    <DataState state={dataStateOf(analyses)} error={analyses.error} onRetry={() => analyses.refetch()}>
      {analyses.data ? (
        <fieldset key={record ? record.id : 'new'} disabled={readOnly} className="min-w-0 border-0 p-0">
          {children(record, save)}
        </fieldset>
      ) : null}
    </DataState>
  );
}

export interface SaveBarProps {
  onSave: () => Promise<unknown>;
  disabled?: boolean;
  /** why saving is not possible yet (shown next to the disabled button) */
  hint?: string;
  label?: string;
  updatedAt?: string | null;
}

/** Save button with its status, the friendly error and the last-saved time; hidden for read-only users. */
export function SaveBar({ onSave, disabled, hint, label = 'Save', updatedAt }: SaveBarProps) {
  const { readOnly } = useCaseWorkspace();
  const { dateTime } = useRcaFormat();
  const [state, setState] = useState<{ busy: boolean; error: unknown; saved: boolean }>({ busy: false, error: null, saved: false });
  if (readOnly) return updatedAt ? <p className="text-sm text-muted-foreground">Last saved {dateTime(updatedAt)}.</p> : null;
  const save = async () => {
    setState({ busy: true, error: null, saved: false });
    try {
      await onSave();
      setState({ busy: false, error: null, saved: true });
    } catch (error) {
      setState({ busy: false, error, saved: false });
    }
  };
  return (
    <div className="space-y-2">
      {state.error ? <FriendlyErrorAlert error={state.error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={disabled || state.busy} onClick={() => void save()} data-testid="save-tool">
          {state.busy ? 'Saving…' : label}
        </Button>
        {disabled && hint && <span className="text-sm text-muted-foreground">{hint}</span>}
        {state.saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Saved.
          </span>
        )}
        {!state.saved && updatedAt && <span className="text-sm text-muted-foreground">Last saved {dateTime(updatedAt)}.</span>}
      </div>
    </div>
  );
}
