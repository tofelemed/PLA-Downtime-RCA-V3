import { LossKind } from '../domain/accounting/accounting.types';
import { Dec } from '../domain/actuals/decimal';
import {
  CANDIDATE_ACTIONS,
  SIGNED_LINE_KINDS,
  ToleranceRule,
} from '../domain/reconciliation/reconciliation.types';
import { LossLine } from '../accounting/entities/loss-line.entity';
import { DraftLineInput } from './draft-line.input';
import { lineInvalid } from './workflow-errors';

/** A line after the shape checks: its slice and kind are known. */
export interface ShapedLine {
  input: DraftLineInput;
  index: number;
  sliceId: string;
  kind: LossKind;
  candidate: LossLine | null;
  quantity: Dec | null;
}

/**
 * Manual lines that explain a difference away instead of naming a loss (RC-02): a bridge and an
 * Unaccounted classification carry a written reason, so the approver sees why they close the gap.
 */
const EXPLAINING_MANUAL_KINDS: ReadonlySet<LossKind> = new Set([
  'bridge',
  'unaccounted_classified',
]);

function requireReason(input: DraftLineInput, index: number): void {
  if (!input.reason?.trim()) {
    throw lineInvalid(
      'REASON_REQUIRED',
      index,
      `${input.action} needs a reason`,
    );
  }
}

function quantityOf(
  input: DraftLineInput,
  index: number,
  kind: LossKind,
): Dec | null {
  const needed = input.action !== 'accept' && input.action !== 'reject';
  if (!needed) {
    if (input.quantity !== undefined)
      throw lineInvalid(
        'INVALID_LINE',
        index,
        `${input.action} takes no quantity`,
      );
    return null;
  }
  if (input.quantity === undefined)
    throw lineInvalid(
      'QUANTITY_REQUIRED',
      index,
      `${input.action} needs a quantity`,
    );
  const quantity = new Dec(input.quantity);
  if (quantity.isNegative() && !SIGNED_LINE_KINDS.has(kind)) {
    throw lineInvalid(
      'NEGATIVE_QUANTITY',
      index,
      `a ${kind} line cannot be negative`,
    );
  }
  return quantity;
}

function decisionShape(
  input: DraftLineInput,
  index: number,
  candidates: ReadonlyMap<string, LossLine>,
): { sliceId: string; kind: LossKind; candidate: LossLine } {
  const candidate = input.autoKey ? candidates.get(input.autoKey) : undefined;
  if (!candidate) {
    throw lineInvalid(
      'UNKNOWN_CANDIDATE',
      index,
      'autoKey is not a candidate of the base run',
    );
  }
  if (input.sliceId && input.sliceId !== candidate.sliceId) {
    throw lineInvalid(
      'INVALID_REFERENCE',
      index,
      'sliceId is not the slice of the candidate',
    );
  }
  if (input.action !== 'accept') requireReason(input, index);
  const kind = input.action === 'replace' ? input.kind : candidate.kind;
  if (!kind) throw lineInvalid('KIND_REQUIRED', index, 'replace needs a kind');
  return { sliceId: candidate.sliceId, kind, candidate };
}

function evidenceShape(input: DraftLineInput, index: number): void {
  const events = input.eventIds?.length ?? 0;
  if (input.missingEvent && events > 0) {
    throw lineInvalid(
      'INVALID_LINE',
      index,
      'missingEvent and eventIds exclude each other',
    );
  }
  if (events === 0 && !input.adjustmentId && !input.missingEvent) {
    throw lineInvalid(
      'EVIDENCE_REQUIRED',
      index,
      'a manual line references an event, an approved adjustment, or a cause without event (missingEvent: true)',
    );
  }
  if (input.missingEvent && !input.reasonCodeId && !input.missingCode) {
    throw lineInvalid(
      'CODE_REQUIRED',
      index,
      'a cause without event needs a reason code or missingCode: true',
    );
  }
  if (input.missingCode && input.reasonCodeId) {
    throw lineInvalid(
      'INVALID_LINE',
      index,
      'missingCode and reasonCodeId exclude each other',
    );
  }
}

function manualShape(
  input: DraftLineInput,
  index: number,
): { sliceId: string; kind: LossKind } {
  if (input.autoKey) {
    throw lineInvalid(
      'INVALID_LINE',
      index,
      'a manual line has no autoKey (use replace to override a candidate)',
    );
  }
  if (!input.sliceId)
    throw lineInvalid('SLICE_REQUIRED', index, 'a manual line needs sliceId');
  if (!input.kind)
    throw lineInvalid('KIND_REQUIRED', index, 'a manual line needs a kind');
  evidenceShape(input, index);
  return { sliceId: input.sliceId, kind: input.kind };
}

/**
 * Shape rules of a draft save (§15.3, ACC07): decisions name a candidate of the base run once each (with a
 * reason except for accept; replace names the new kind), manual lines name a slice, a kind (a bridge or an
 * Unaccounted classification with a reason, RC-02) and their
 * evidence (event, approved adjustment, or an explicit cause without event that is coded or explicitly
 * uncoded), quantities are non-negative except bridge / gain, and an Unaccounted classification needs a
 * policy that allows it. Throws 422 with the offending line index.
 */
export function shapeLines(
  inputs: readonly DraftLineInput[],
  candidateLines: readonly LossLine[],
  rule: ToleranceRule,
): ShapedLine[] {
  const candidates = new Map(
    candidateLines.map((line) => [line.autoKey ?? line.id, line]),
  );
  const decided = new Set<string>();
  return inputs.map((input, index) => {
    const isDecision = CANDIDATE_ACTIONS.has(input.action);
    if (isDecision && input.autoKey) {
      if (decided.has(input.autoKey))
        throw lineInvalid(
          'DUPLICATE_DECISION',
          index,
          'the candidate is decided twice',
        );
      decided.add(input.autoKey);
    }
    const shape = isDecision
      ? decisionShape(input, index, candidates)
      : { ...manualShape(input, index), candidate: null };
    if (
      shape.kind === 'unaccounted_classified' &&
      !rule.allowUnaccountedClassification
    ) {
      throw lineInvalid(
        'UNACCOUNTED_NOT_ALLOWED',
        index,
        'the tolerance policy does not allow an Unaccounted classification',
      );
    }
    if (!isDecision && EXPLAINING_MANUAL_KINDS.has(shape.kind))
      requireReason(input, index);
    const quantity = quantityOf(input, index, shape.kind);
    return { input, index, ...shape, quantity };
  });
}
