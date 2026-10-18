import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** What the editor of a record tool tells its frame (F-6): whether it differs from the saved record. */
export interface ToolDraftValue {
  /** true while the editor's content differs from what was loaded or last saved */
  dirty: boolean;
  /** the editor reports its content and state after each change */
  report: (dirty: boolean, content: unknown) => void;
  /** the body of the last own save (count changes on every save), the editor's new baseline */
  lastSaved: { count: number; json: string } | null;
}

export const ToolDraftContext = createContext<ToolDraftValue | null>(null);

export function useToolDraftContext(): ToolDraftValue | null {
  return useContext(ToolDraftContext);
}

/**
 * The content state of a record-tool editor that knows whether it is unsaved: compared with what was
 * loaded, and with the last saved body after each own save. Use it in place of `useState` in an editor.
 */
export function useToolDraft<T>(init: () => T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const frame = useToolDraftContext();
  const [content, setContent] = useState<T>(init);
  const [baseline, setBaseline] = useState(() => JSON.stringify(content));
  const [seen, setSeen] = useState(frame?.lastSaved?.count ?? 0);
  const saved = frame?.lastSaved ?? null;
  if (saved && saved.count !== seen) {
    setSeen(saved.count);
    setBaseline(saved.json);
  }
  const dirty = JSON.stringify(content) !== baseline;
  const report = frame?.report;
  useEffect(() => {
    report?.(dirty, content);
  }, [report, dirty, content]);
  return [content, setContent, dirty];
}
