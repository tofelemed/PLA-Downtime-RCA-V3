import { useState, type ReactNode } from 'react';
import type { RcaAnalysisBodies, RcaRecordTool } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';
import { useRcaFormat } from '../../../use-rca-format';
import { useCaseWorkspace } from '../../case-context';
import { ToolConflict } from './tool-conflict';
import { ToolDraftContext, useToolDraftContext } from './tool-draft';
import type { ToolRecord } from './tool-record-query';
import { useToolFrame } from './use-tool-frame';

export type { ToolRecord } from './tool-record-query';

export interface ToolFrameProps<K extends RcaRecordTool> {
  tool: K;
  /** the editor, mounted once the record is loaded, and again when another person's version is adopted */
  children: (record: ToolRecord<K>, save: (body: RcaAnalysisBodies[K]) => Promise<unknown>) => ReactNode;
}

/**
 * Loads the tool's record and renders the editor with it (F-6): the editor is keyed on the record version
 * it works on, leaving with unsaved changes asks first, and a concurrent save offers "Reload latest" while
 * the user's own text stays visible. On a read-only case each editor renders its values as text.
 */
export function ToolFrame<K extends RcaRecordTool>({ tool, children }: ToolFrameProps<K>) {
  const frame = useToolFrame(tool);
  const analyses = frame.query.analyses;
  return (
    <DataState state={dataStateOf(analyses)} error={analyses.error} onRetry={() => analyses.refetch()}>
      {analyses.data ? (
        <ToolDraftContext.Provider value={frame.context}>
          <div className="space-y-3">
            <ToolConflict conflict={frame.conflict} keptText={frame.keptText} reloading={frame.reloading} onReload={() => void frame.reload()} onDismissKept={frame.dismissKept} />
            <div key={frame.view.key} className="min-w-0">
              {children(frame.view.record, frame.save)}
            </div>
          </div>
        </ToolDraftContext.Provider>
      ) : null}
    </DataState>
  );
}

/** "Unsaved changes" or "Saved" next to the save button (F-6), with the last-saved time; nothing before a first save. */
function SaveState({ dirty, justSaved, updatedAt }: { dirty: boolean; justSaved: boolean; updatedAt?: string | null }) {
  const { dateTime } = useRcaFormat();
  if (dirty) {
    return (
      <StatusBadge tone="info" icon={StatusIcon.pending} data-testid="save-state" data-state="unsaved">
        Unsaved changes
      </StatusBadge>
    );
  }
  if (justSaved) {
    return (
      <span role="status" className="text-sm text-muted-foreground">
        Saved.
      </span>
    );
  }
  if (!updatedAt) return null;
  return (
    <>
      <StatusBadge tone="success" icon={StatusIcon.success} data-testid="save-state" data-state="saved">
        Saved
      </StatusBadge>
      <span className="text-sm text-muted-foreground">Last saved {dateTime(updatedAt)}.</span>
    </>
  );
}

/** Runs a save and keeps its busy / error / saved state for the bar. */
function useSaveRun(onSave: () => Promise<unknown>) {
  const [state, setState] = useState<{ busy: boolean; error: unknown; saved: boolean }>({ busy: false, error: null, saved: false });
  const run = async () => {
    setState({ busy: true, error: null, saved: false });
    try {
      await onSave();
      setState({ busy: false, error: null, saved: true });
    } catch (error) {
      setState({ busy: false, error, saved: false });
    }
  };
  return { ...state, run };
}

/** The editor's own unsaved flag, else the frame's (false outside a frame). */
function useUnsaved(dirty: boolean | undefined): boolean {
  const frame = useToolDraftContext();
  return dirty ?? frame?.dirty ?? false;
}

export interface SaveBarProps {
  onSave: () => Promise<unknown>;
  disabled?: boolean;
  /** why saving is not possible yet (shown next to the disabled button) */
  hint?: string;
  label?: string;
  updatedAt?: string | null;
  /** unsaved state of an editor outside a `ToolFrame` (inside one, the frame knows it) */
  dirty?: boolean;
}

/** Save button with its status, the saved / unsaved indicator, the friendly error and the last-saved time. */
export function SaveBar({ onSave, disabled, hint, label = 'Save', updatedAt, dirty }: SaveBarProps) {
  const { readOnly } = useCaseWorkspace();
  const { dateTime } = useRcaFormat();
  const unsaved = useUnsaved(dirty);
  const save = useSaveRun(onSave);
  if (readOnly) return updatedAt ? <p className="text-sm text-muted-foreground">Last saved {dateTime(updatedAt)}.</p> : null;
  return (
    <div className="space-y-2">
      {save.error ? <FriendlyErrorAlert error={save.error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-9" disabled={disabled || save.busy} onClick={() => void save.run()} data-testid="save-tool">
          {save.busy ? 'Saving…' : label}
        </Button>
        <SaveState dirty={unsaved} justSaved={save.saved} updatedAt={updatedAt} />
        {disabled && hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
