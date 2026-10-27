import { useState } from 'react';
import type { ProductionEventView, ReasonWeightInput } from '@/api/v2/types/events';
import { tonnesEntriesValid, tonnesSplitFits } from '../model/declared-split';
import { hasSplit, initialSplitRows, reasonWeightsBody, splitComplete, type SplitMode, type SplitRow } from '../model/reason-split';

/** What the split adds to a PATCH: the entered weights, `null` to remove a stored split, or nothing. */
export type SplitChange = { reasonWeights: ReasonWeightInput[] | null } | Record<string, never>;

/**
 * State of the optional "Split across several reasons" section of the coding dialog (D-T5). `shortfall`
 * (declared mode, a production loss event) offers tonnes instead of minutes: the tonnes must add up to it.
 */
export function useReasonSplit(event: Pick<ProductionEventView, 'reasonCodeId' | 'reasonWeights' | 'durationSeconds'>, shortfall: number | null = null) {
  const stored = hasSplit(event.reasonWeights);
  const [enabled, setEnabled] = useState(stored);
  const [mode, setMode] = useState<SplitMode>('percent');
  const [rows, setRows] = useState<SplitRow[]>(() => initialSplitRows(event));
  const update = (key: number, patch: Partial<SplitRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () => setRows((current) => [...current, { key: Math.max(...current.map((r) => r.key)) + 1, reasonCodeId: '', value: '' }]);
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  const change = (): SplitChange => {
    if (enabled) return { reasonWeights: reasonWeightsBody(rows, mode) };
    return stored ? { reasonWeights: null } : {};
  };
  return {
    enabled,
    setEnabled,
    mode,
    setMode,
    rows,
    update,
    add,
    remove,
    change,
    /** minutes need the stop's length: a running stop is split by percent only */
    minutesAllowed: event.durationSeconds !== null,
    /** declared mode: the day's shortfall in tonnes (null for a stop) */
    shortfall,
    complete: !enabled || (splitComplete(rows) && (mode !== 'tonnes' || (shortfall !== null && tonnesEntriesValid(rows) && tonnesSplitFits(rows, shortfall)))),
  };
}

export type ReasonSplitState = ReturnType<typeof useReasonSplit>;
