import type { ProductionEventView } from '@/api/v2/types/events';
import { recoveryValid, tonnesEntriesValid, tonnesSplitFits } from '../model/declared-split';
import { splitChange, splitComplete, type SplitRow } from '../model/reason-split';
import { shortfallOf } from '../model/production-loss';
import type { EventFormState } from './use-event-form';
import type { ReasonSplitState } from './use-reason-split';

type SplitForm = Pick<EventFormState, 'values' | 'setField'>;

/**
 * The D-T5 split section over the event form's values (edit page): the same state the coding dialog's
 * `useReasonSplit` keeps, read from and written to the draft so a reload restores it. `event` null (a
 * new event): a running stop's rules, no shortfall.
 */
export function useFormReasonSplit(form: SplitForm, event: ProductionEventView | null): ReasonSplitState {
  const { values, setField } = form;
  const { splitEnabled: enabled, splitMode: mode, splitRows: rows } = values;
  const setRows = (next: SplitRow[]) => setField('splitRows', next);
  const shortfall = event ? shortfallOf(event) : null;
  const tonnesOk = mode !== 'tonnes' || (shortfall !== null && tonnesEntriesValid(rows) && tonnesSplitFits(rows, shortfall));
  return {
    enabled,
    setEnabled: (next) => setField('splitEnabled', next),
    mode,
    setMode: (next) => setField('splitMode', next),
    rows,
    update: (key, patch) => setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    add: () => setRows([...rows, { key: Math.max(-1, ...rows.map((row) => row.key)) + 1, reasonCodeId: '', value: '' }]),
    remove: (key) => setRows(rows.filter((row) => row.key !== key)),
    change: () => splitChange(event?.reasonWeights ?? null, { enabled, rows, mode }),
    minutesAllowed: event?.durationSeconds != null,
    shortfall,
    complete: !enabled || (splitComplete(rows) && recoveryValid(rows) && tonnesOk),
  };
}
