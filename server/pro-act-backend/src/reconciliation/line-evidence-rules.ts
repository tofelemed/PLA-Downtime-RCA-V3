import { Dec } from '../domain/actuals/decimal';
import { ManualKind } from '../domain/reconciliation/reconciliation.types';
import { DraftLineInput } from './draft-line.input';
import { lineInvalid } from './workflow-errors';

/** SME R7: what an Unaccounted line says about the residual it closes. */
export const UNACCOUNTED_CATEGORIES = [
  'measurement_adjustment',
  'timing_inventory',
  'source_data_gap',
  'unexplained_cause',
] as const;

/** SME R8: the supported adjustment a bridge stands for (kept apart from an unexplained residual). */
export const BRIDGE_CATEGORIES = [
  'inventory',
  'timing',
  'measurement',
] as const;

/** SME R11: what a manual line's quantity rests on when no event or approved adjustment backs it. */
export const EVIDENCE_TYPES = [
  'log',
  'work_order',
  'rate_record',
  'totalizer',
  'lot_sample',
  'movement_record',
  'measurement_record',
  'investigation_note',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

const ALLOWED_EVIDENCE: Readonly<Record<ManualKind, readonly EvidenceType[]>> =
  {
    availability: ['log', 'work_order'],
    performance: ['rate_record', 'totalizer'],
    quality: ['lot_sample'],
    // SME R9: a recovery gain is measured, never a balancing figure
    gain: ['rate_record', 'totalizer', 'measurement_record'],
    bridge: ['movement_record', 'measurement_record'],
    unaccounted_classified: ['investigation_note'],
    // SME R9: the record showing the earlier entry was wrong (a note alone is not proof)
    reversal: [
      'log',
      'work_order',
      'rate_record',
      'totalizer',
      'lot_sample',
      'movement_record',
      'measurement_record',
    ],
  };

const CATEGORIES: Partial<Record<ManualKind, readonly string[]>> = {
  unaccounted_classified: UNACCOUNTED_CATEGORIES,
  bridge: BRIDGE_CATEGORIES,
};

function assertCategory(
  input: DraftLineInput,
  index: number,
  kind: ManualKind,
) {
  const allowed = CATEGORIES[kind];
  if (!allowed) {
    if (input.classification)
      throw lineInvalid(
        'CATEGORY_NOT_ALLOWED',
        index,
        `a ${kind} line has no category`,
      );
    return;
  }
  if (!input.classification)
    throw lineInvalid(
      'CATEGORY_REQUIRED',
      index,
      `a ${kind} line needs a category (${allowed.join(', ')})`,
    );
  if (!allowed.includes(input.classification))
    throw lineInvalid(
      'CATEGORY_NOT_ALLOWED',
      index,
      `${input.classification} is not a ${kind} category`,
    );
}

/** An event or an approved adjustment backs a loss line; bridges, Unaccounted lines and reversals always need their own record. */
const backedByRecord = (input: DraftLineInput, kind: ManualKind) =>
  kind !== 'bridge' &&
  kind !== 'unaccounted_classified' &&
  kind !== 'reversal' &&
  ((input.eventIds?.length ?? 0) > 0 || Boolean(input.adjustmentId));

function assertEvidence(
  input: DraftLineInput,
  index: number,
  kind: ManualKind,
) {
  if (backedByRecord(input, kind)) return;
  const allowed = ALLOWED_EVIDENCE[kind];
  if (!input.evidenceType || !input.evidenceRef?.trim())
    throw lineInvalid(
      'EVIDENCE_REQUIRED',
      index,
      `a ${kind} line without an event needs evidence (${allowed.join(', ')}) and its reference`,
    );
  if (!allowed.includes(input.evidenceType))
    throw lineInvalid(
      'EVIDENCE_TYPE_NOT_ALLOWED',
      index,
      `${input.evidenceType} does not prove a ${kind} quantity (${allowed.join(', ')})`,
    );
}

function assertBridge(
  input: DraftLineInput,
  index: number,
  mayBridge: boolean,
) {
  if (!mayBridge)
    throw lineInvalid(
      'BRIDGE_NOT_ALLOWED',
      index,
      'only production accounting enters bridge lines',
    );
  if (input.quantity !== undefined && new Dec(input.quantity).isNegative())
    throw lineInvalid(
      'NEGATIVE_BRIDGE',
      index,
      'a bridge cannot be negative: correct the over-claimed lines instead',
    );
}

/** SME R9: a reversal names the approved line it reverses; no other line does. */
function assertReversalTarget(input: DraftLineInput, index: number) {
  const reversal = input.action === 'manual' && input.kind === 'reversal';
  if (reversal && !input.reversesLineId)
    throw lineInvalid(
      'REVERSAL_TARGET_REQUIRED',
      index,
      'a reversal names the approved line it reverses (reversesLineId)',
    );
  if (!reversal && input.reversesLineId)
    throw lineInvalid(
      'INVALID_LINE',
      index,
      'only a manual reversal line names reversesLineId',
    );
}

/**
 * Rules of a manual line from the SME answers (14 Oct 2026): R7 an Unaccounted line names its category and
 * the investigation; R8 a bridge is production accounting's, with a category and a record; R9 no negative
 * balancing bridge; R11 a quantity without an event or approved adjustment cites evidence that suits its
 * kind. Throws 422 with the line index.
 */
export function assertManualLineRules(
  input: DraftLineInput,
  index: number,
  context: { mayBridge: boolean },
): void {
  assertReversalTarget(input, index);
  const kind = input.kind;
  if (input.action !== 'manual' || !kind) return;
  assertCategory(input, index, kind);
  if (kind === 'bridge') assertBridge(input, index, context.mayBridge);
  assertEvidence(input, index, kind);
}
