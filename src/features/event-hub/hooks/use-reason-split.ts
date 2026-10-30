import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { recoveryValid, tonnesEntriesValid, tonnesSplitFits } from '../model/declared-split';
import { hasSplit, initialSplitRows, splitChange, splitComplete, type SplitChange, type SplitMode, type SplitRow } from '../model/reason-split';

export type { SplitChange } from '../model/reason-split';

/** State of the "Split across several reasons" section (D-T5), as the coding dialog and the edit page provide it. */
export interface ReasonSplitState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  mode: SplitMode;
  setMode: (mode: SplitMode) => void;
  rows: SplitRow[];
  update: (key: number, patch: Partial<SplitRow>) => void;
  add: () => void;
  remove: (key: number) => void;
  change: () => SplitChange;
  /** minutes need the stop's length: a running stop is split by percent only */
  minutesAllowed: boolean;
  /** declared mode: the day's shortfall in tonnes (null for a stop) */
  shortfall: number | null;
  /** every row named and valued (and, in tonnes, adding up to the shortfall); true while not enabled */
  complete: boolean;
}

/**
 * State of the optional "Split across several reasons" section of the coding dialog (D-T5). `shortfall`
 * (declared mode, a production loss event) offers tonnes instead of minutes: the tonnes must add up to it.
 */
export function useReasonSplit(event: Pick<ProductionEventView, 'reasonCodeId' | 'reasonWeights' | 'durationSeconds'>, shortfall: number | null = null): ReasonSplitState {
  const [enabled, setEnabled] = useState(hasSplit(event.reasonWeights));
  const [mode, setMode] = useState<SplitMode>('percent');
  const [rows, setRows] = useState<SplitRow[]>(() => initialSplitRows(event));
  const update = (key: number, patch: Partial<SplitRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () => setRows((current) => [...current, { key: Math.max(...current.map((r) => r.key)) + 1, reasonCodeId: '', value: '' }]);
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  return {
    enabled,
    setEnabled,
    mode,
    setMode,
    rows,
    update,
    add,
    remove,
    change: () => splitChange(event.reasonWeights, { enabled, rows, mode }),
    minutesAllowed: event.durationSeconds !== null,
    shortfall,
    complete: !enabled || (splitComplete(rows) && recoveryValid(rows) && (mode !== 'tonnes' || (shortfall !== null && tonnesEntriesValid(rows) && tonnesSplitFits(rows, shortfall)))),
  };
}
