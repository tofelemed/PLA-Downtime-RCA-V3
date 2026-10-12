import type { MasterUnitView } from '../api/master-data-types';
import { optionalDecimal, requiredText, textOrNull, type FieldErrors } from '../model/field-errors';

export interface UnitDraft {
  code: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  capacity: string;
  idealCycleTimeSeconds: string;
}

export interface UnitBody {
  code: string;
  name: string;
  description: string | null;
  unitOfMeasure: string | null;
  capacity: string | null;
  idealCycleTimeSeconds: string | null;
}

export function unitDraftOf(unit: MasterUnitView | null): UnitDraft {
  return {
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    description: unit?.description ?? '',
    unitOfMeasure: unit?.unitOfMeasure ?? '',
    capacity: unit?.capacity ?? '',
    idealCycleTimeSeconds: unit?.idealCycleTimeSeconds ?? '',
  };
}

export function validateUnit(draft: UnitDraft): FieldErrors {
  return {
    name: requiredText(draft.name, 'Name'),
    code: requiredText(draft.code, 'Code'),
    capacity: optionalDecimal(draft.capacity, 'Capacity'),
    idealCycleTimeSeconds: optionalDecimal(draft.idealCycleTimeSeconds, 'Ideal cycle time'),
  };
}

/** The whole unit as a body (create, and the PATCH of a form that edits every field). */
export function unitBodyOf(draft: UnitDraft): UnitBody {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: textOrNull(draft.description),
    unitOfMeasure: textOrNull(draft.unitOfMeasure),
    capacity: textOrNull(draft.capacity),
    idealCycleTimeSeconds: textOrNull(draft.idealCycleTimeSeconds),
  };
}

