import type { PatchEventInput } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { recoveryValid } from './declared-split';
import { hasSplit, initialSplitRows, reasonWeightsBody, splitComplete, type SplitMode, type SplitRow } from './reason-split';

/**
 * The reason part of the event form beyond the code itself: the coding note (owner decision 2026-10-30:
 * free text beside the code, never instead of it) and, on edit, the D-T5 split across several reasons
 * as typed. The split lives in the form values so a draft keeps it like every other field.
 */
export interface ReasonFormValues {
  /** `codingNote`, ≤ 1000: what happened in the coder's own words; '' = none */
  codingNote: string;
  /** edit only, the roles of `canSplitReasons`: the event is split across several reasons */
  splitEnabled: boolean;
  splitMode: SplitMode;
  splitRows: SplitRow[];
}

export const EMPTY_REASON_FORM: ReasonFormValues = { codingNote: '', splitEnabled: false, splitMode: 'percent', splitRows: [] };

/** The stored split (as percents) starts enabled; otherwise the current reason and one empty row, not enabled. */
export function reasonValuesOf(event: Pick<ProductionEventView, 'codingNote' | 'reasonCodeId' | 'reasonWeights'>): ReasonFormValues {
  return { codingNote: event.codingNote ?? '', splitEnabled: hasSplit(event.reasonWeights), splitMode: 'percent', splitRows: initialSplitRows(event) };
}

export const SPLIT_INCOMPLETE_MESSAGE = 'Give every row a reason and a share, or untick the split';
export const SPLIT_RECOVERY_ONLY_MESSAGE = 'A split needs at least one loss share beside the recoveries';

/** What the browser checks of an enabled split; the sum is the server's (422 on `reasonWeights`, shown here). */
export function reasonFormErrors(values: Pick<ReasonFormValues, 'splitEnabled' | 'splitRows'>): Partial<Record<'splitRows', string>> {
  if (!values.splitEnabled) return {};
  if (!splitComplete(values.splitRows)) return { splitRows: SPLIT_INCOMPLETE_MESSAGE };
  if (!recoveryValid(values.splitRows)) return { splitRows: SPLIT_RECOVERY_ONLY_MESSAGE };
  return {};
}

type PatchBody = PatchEventInput['changes'];
type ReasonPatchValues = ReasonFormValues & { reasonCodeId: string };

const sameRows = (a: readonly SplitRow[], b: readonly SplitRow[]) => JSON.stringify(a) === JSON.stringify(b);

/** The split's PATCH: its weights when enabled and changed, `null` when a stored split is unticked. */
function splitPatch(initial: ReasonPatchValues, values: ReasonPatchValues): PatchBody {
  if (!values.splitEnabled) return initial.splitEnabled ? { reasonWeights: null } : {};
  const changed = !initial.splitEnabled || values.splitMode !== initial.splitMode || !sameRows(values.splitRows, initial.splitRows);
  return changed ? { reasonWeights: reasonWeightsBody(values.splitRows, values.splitMode) } : {};
}

/**
 * PATCH fields of the reason section: the code while there is no split (the weights name the primary
 * reason otherwise), the split's weights or its removal, and the note (`null` clears a stored one).
 */
export function reasonPatchFields(initial: ReasonPatchValues, values: ReasonPatchValues): PatchBody {
  const changes: PatchBody = splitPatch(initial, values);
  if (!values.splitEnabled && values.reasonCodeId !== initial.reasonCodeId) changes.reasonCodeId = values.reasonCodeId || null;
  if (values.codingNote !== initial.codingNote) changes.codingNote = values.codingNote.trim() || null;
  return changes;
}
