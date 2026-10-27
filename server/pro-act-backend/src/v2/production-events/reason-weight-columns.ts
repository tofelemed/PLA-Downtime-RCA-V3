import { UnprocessableEntityException } from '@nestjs/common';
import {
  isWeighted,
  normaliseReasonWeights,
  ReasonWeight,
  ReasonWeightEntry,
  ReasonWeightResult,
} from '../../domain/events/reason-weights';
import { EventReferencesValidator } from './event-references.validator';

/** The stored reason coding of an event a write starts from. */
export interface StoredReason {
  reasonCodeId?: string | null;
  reasonWeights?: readonly ReasonWeight[] | null;
  startTime: Date;
  endTime?: Date | null;
  /** declared mode: the stored kind and quantity; a production loss splits its tonnes */
  physicalType?: string;
  quantity?: number | string | null;
}

/** The reason fields of a write: the primary reason code and the entered weights (null = remove the split). */
export interface ReasonWrite {
  reasonCodeId?: string | null;
  reasonWeights?: readonly ReasonWeightEntry[] | null;
  /** the request's own kind, quantity and shortfall (a PATCH may retype or re-declare the event) */
  physicalType?: string;
  quantity?: string | null;
  declaredFigures?: { shortfall: number };
}

/** What a write stores: the primary reason (when the weights set it) and the normalised weights. */
export interface WeightedReasonColumns {
  reasonCodeId?: string;
  reasonWeights?: ReasonWeight[] | null;
}

/** 422 with the rule the entered weights break (the field is `field`, the code names the rule). */
export function reasonWeightsError(
  result: Extract<ReasonWeightResult, { ok: false }>,
  field = 'reasonWeights',
): UnprocessableEntityException {
  const { code, message } = result.error;
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

/** A PATCH end time as a date (null clears it). */
export function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/** The tonnes a production loss is split across (the request's shortfall or quantity, else the stored one); null for other kinds. */
function lossQuantity(stored: StoredReason, write: ReasonWrite): number | null {
  const kind = write.physicalType ?? stored.physicalType;
  if (kind !== 'production_loss') return null;
  const stated = write.declaredFigures?.shortfall ?? write.quantity;
  const quantity = stated ?? stored.quantity;
  return quantity === null || quantity === undefined ? null : Number(quantity);
}

function durationOf(event: StoredReason, endTime?: Date | null): number | null {
  const end = endTime === undefined ? event.endTime : endTime;
  if (!end) return null;
  return Math.round((end.getTime() - event.startTime.getTime()) / 1000);
}

/**
 * D-T5 columns of a PATCH: entered weights are normalised against the stop (percent, or seconds of the
 * closed stop) and set the primary reason code; `null` removes the split and keeps the reason code. A
 * write that sets another reason code without weights, or clears the reason, removes a stored split,
 * because the split no longer starts with that reason. 422 (`REASON_WEIGHTS_*`) on a broken rule.
 */
export function weightedReasonColumns(
  stored: StoredReason,
  write: ReasonWrite,
  endTime?: Date | null,
): WeightedReasonColumns {
  if (write.reasonWeights === null) return { reasonWeights: null };
  if (write.reasonWeights === undefined) {
    const recoded =
      write.reasonCodeId !== undefined &&
      write.reasonCodeId !== (stored.reasonCodeId ?? null);
    return recoded && isWeighted(stored.reasonWeights)
      ? { reasonWeights: null }
      : {};
  }
  if (write.reasonCodeId === null) {
    throw reasonWeightsError({
      ok: false,
      error: {
        code: 'REASON_WEIGHTS_PRIMARY',
        message:
          'A split needs a reason code; send reasonWeights null to remove it',
      },
    });
  }
  const result = normaliseReasonWeights(write.reasonWeights, {
    durationSeconds: durationOf(stored, endTime),
    reasonCodeId: write.reasonCodeId,
    quantity: lossQuantity(stored, write),
  });
  if (!result.ok) throw reasonWeightsError(result);
  return { reasonCodeId: result.primary, reasonWeights: result.weights };
}

/** The reason codes a write names through its weights (to check they are the tenant's). */
export function weightedReasonIds(columns: WeightedReasonColumns): string[] {
  return (columns.reasonWeights ?? []).map((w) => w.reasonCodeId);
}

/**
 * D-T5 weighted reasons of a bulk code: percent only (the selected stops differ in length), normalised
 * once for every event; the largest reason becomes the bulk reason code.
 */
export function bulkReasonWeights(
  entries: readonly ReasonWeightEntry[],
  reasonCodeId: string | undefined,
): Required<WeightedReasonColumns> {
  const field = 'codes.reasonWeights';
  if (entries.some((entry) => entry.seconds !== undefined)) {
    throw reasonWeightsError(
      {
        ok: false,
        error: {
          code: 'REASON_WEIGHTS_BASIS',
          message:
            'Bulk coding splits stops by percent only, because the selected stops differ in length',
        },
      },
      field,
    );
  }
  const result = normaliseReasonWeights(entries, {
    durationSeconds: null,
    reasonCodeId,
  });
  if (!result.ok) throw reasonWeightsError(result, field);
  return { reasonCodeId: result.primary, reasonWeights: result.weights };
}

/**
 * D-T5 weighted reasons of a v2 PATCH against the stored event (a changed end of a manual event counts),
 * with every reason of the split checked against the tenant's library (422 INVALID_REFERENCE).
 */
export async function patchReasonWeights(
  references: Pick<EventReferencesValidator, 'assertReasonCodesOwned'>,
  tenantId: string,
  write: {
    existing: StoredReason;
    dto: ReasonWrite & { endTime?: string | null };
  },
): Promise<WeightedReasonColumns> {
  const { existing, dto } = write;
  const end = dto.endTime === undefined ? undefined : toDate(dto.endTime);
  const weighted = weightedReasonColumns(existing, dto, end);
  await references.assertReasonCodesOwned(
    tenantId,
    weightedReasonIds(weighted),
  );
  return weighted;
}
