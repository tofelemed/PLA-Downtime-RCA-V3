import { useEffect, useState } from 'react';
import { useRcaCase } from '@/api/v2/queries/rca-cases';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { isVersionConflict } from '../use-tool-frame';
import { diagramText } from './diagram-model';

interface Opened {
  /** the case version the canvas was loaded from: the If-Match of the next save */
  rowVersion: number;
  diagram: RcaEventDiagram;
}

/**
 * F-6 for the event diagram: the save sends If-Match = the version the canvas was opened with (not the
 * newest cached one, which would overwrite another person's save). A newer saved case is adopted only
 * while there are no unsaved changes; a 412 offers "Reload latest" and keeps the user's diagram as text.
 */
export function useDiagramSession(current: RcaEventDiagram, apply: (diagram: RcaEventDiagram) => void) {
  const { rca } = useCaseWorkspace();
  const patch = useCasePatch();
  const detail = useRcaCase(rca.id);
  const [opened, setOpened] = useState<Opened>(() => ({ rowVersion: rca.rowVersion, diagram: rca.eventDiagram }));
  const [conflict, setConflict] = useState(false);
  const [keptText, setKeptText] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const dirty = JSON.stringify(current) !== JSON.stringify(opened.diagram);
  const stale = rca.rowVersion !== opened.rowVersion && !dirty && !conflict;
  useEffect(() => {
    if (!stale) return;
    setOpened({ rowVersion: rca.rowVersion, diagram: rca.eventDiagram });
    apply(rca.eventDiagram);
  }, [stale, rca.rowVersion, rca.eventDiagram, apply]);
  const save = async () => {
    try {
      const saved = await patch.save({ eventDiagram: current }, opened.rowVersion);
      setOpened({ rowVersion: saved.rowVersion, diagram: current });
      return saved;
    } catch (error) {
      if (isVersionConflict(error)) setConflict(true);
      throw error;
    }
  };
  const reload = async () => {
    setReloading(true);
    const fresh = await detail.refetch();
    setReloading(false);
    const latest = fresh.data;
    if (!latest) return;
    setKeptText(diagramText(current));
    setConflict(false);
    setOpened({ rowVersion: latest.rowVersion, diagram: latest.eventDiagram });
    apply(latest.eventDiagram);
  };
  return { dirty, save, conflict, keptText, reloading, reload, dismissKept: () => setKeptText(null) };
}
