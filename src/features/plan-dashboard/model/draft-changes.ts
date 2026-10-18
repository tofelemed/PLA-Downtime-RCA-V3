import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { draftFromView, type DraftState } from './draft-lines';

/** Same content regardless of key order or absent fields (draft objects are built field by field). */
function sameContent(a: object | undefined, b: object | undefined): boolean {
  if (!a || !b) return a === b;
  const canonical = (value: object) =>
    JSON.stringify(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return canonical(a) === canonical(b);
}

/**
 * How many local edits a discard drops (UI state only): decisions set, changed or cleared against the
 * saved set, manual lines added, changed or removed, and an unfinished manual line.
 */
export function countDraftChanges(draft: DraftState, view: ReconciliationView): number {
  const saved = draftFromView(view);
  const decisionKeys = new Set([...Object.keys(saved.decisions), ...Object.keys(draft.decisions)]);
  let count = [...decisionKeys].filter((key) => !sameContent(saved.decisions[key], draft.decisions[key])).length;
  const savedManual = new Map(saved.manual.map((line) => [line.uid, line]));
  const draftUids = new Set(draft.manual.map((line) => line.uid));
  count += draft.manual.filter((line) => !sameContent(savedManual.get(line.uid), line)).length;
  count += saved.manual.filter((line) => !draftUids.has(line.uid)).length;
  return draft.pendingManual ? count + 1 : count;
}
