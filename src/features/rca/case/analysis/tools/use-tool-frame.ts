import { useCallback, useMemo, useRef, useState } from 'react';
import type { RcaAnalysisBodies, RcaRecordTool } from '@/api/v2/types/rca-analyses';
import { factsOf } from '@/features/ux-kit/errors/error-facts';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { draftText } from '../../../model/draft-text';
import type { ToolDraftValue } from './tool-draft';
import { useToolRecord, type ToolRecord } from './tool-record-query';

/** A save refused because the record changed since it was read (stale If-Match). */
export function isVersionConflict(error: unknown): boolean {
  const { status, code } = factsOf(error);
  return status === 409 || status === 412 || code === 'VERSION_CONFLICT';
}

interface EditorView<K extends RcaRecordTool> {
  record: ToolRecord<K>;
  /** remounts the editor: changes when another person's version is adopted, not on an own save */
  key: string;
}

const keyOf = (record: { rowVersion: number } | null, suffix = '') => `${record ? record.rowVersion : 'new'}${suffix}`;

/**
 * State of a record-tool frame (F-6): the record version the editor works on (keyed on its row version),
 * its unsaved state, the save with If-Match = that version, and the conflict with "Reload latest".
 */
export function useToolFrame<K extends RcaRecordTool>(tool: K) {
  const query = useToolRecord(tool);
  const [view, setView] = useState<EditorView<K>>(() => ({ record: query.record, key: keyOf(query.record) }));
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<ToolDraftValue['lastSaved']>(null);
  const [conflict, setConflict] = useState(false);
  const [keptText, setKeptText] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const draft = useRef<unknown>(null);
  const latest = query.record;
  if (latest?.rowVersion !== view.record?.rowVersion && !dirty && !conflict) setView({ record: latest, key: keyOf(latest) });
  useUnsavedChangesGuard(dirty);
  const report = useCallback((isDirty: boolean, content: unknown) => {
    draft.current = content;
    setDirty(isDirty);
  }, []);
  const save = async (body: RcaAnalysisBodies[K]) => {
    try {
      const saved = await query.save(body, view.record ? view.record.rowVersion : null);
      setView((current) => ({ record: saved as ToolRecord<K>, key: current.key }));
      setLastSaved((current) => ({ count: (current?.count ?? 0) + 1, json: JSON.stringify(body) }));
      return saved;
    } catch (error) {
      if (isVersionConflict(error)) setConflict(true);
      throw error;
    }
  };
  const reload = async () => {
    setReloading(true);
    const fresh = await query.analyses.refetch();
    setReloading(false);
    const record = (fresh.data?.[tool] ?? null) as ToolRecord<K>;
    setKeptText(draftText(draft.current));
    setConflict(false);
    setDirty(false);
    setView({ record, key: keyOf(record, `:reloaded-${Date.now()}`) });
  };
  const context = useMemo<ToolDraftValue>(() => ({ dirty, report, lastSaved }), [dirty, report, lastSaved]);
  return { query, view, save, context, conflict, keptText, reloading, reload, dismissKept: () => setKeptText(null) };
}
