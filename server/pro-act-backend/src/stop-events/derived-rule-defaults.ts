import {
  CODE_DRIVEN_AXES,
  CodeDrivenAxis,
} from '../code-library/classification-basis';
import {
  EventWriteInput,
  IntervalModelFields,
  prepareCreate,
} from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  ActiveCodingRule,
  filledClassification,
  fillOpenAxes,
  withRuleBasis,
} from '../rules/rule-defaults';

/** A new engine event before the rules: its write-model input and the axes the engine itself states. */
export interface EngineDraft {
  unitId: string;
  input: EventWriteInput;
  /** axes that are engine facts (e.g. a stop's schedule class from the state mapping): never filled */
  stated: readonly CodeDrivenAxis[];
}

/**
 * Write-model fields of a new state-engine event with the tenant's active `coding_default` rules applied
 * (plan 3.8): rules fill only the axes the engine does not state, and each filled axis records its rule
 * version in `classification_basis` (a default, not a user override). Without a matching rule the fields
 * are exactly the engine's.
 */
export function engineCreateFields(
  rules: readonly ActiveCodingRule[],
  draft: EngineDraft,
): { fields: IntervalModelFields; columns: Partial<ProductionEvent> } {
  const fields = prepareCreate(draft.input);
  const open = new Set(
    CODE_DRIVEN_AXES.filter((axis) => !draft.stated.includes(axis)),
  );
  const fill = fillOpenAxes(
    rules,
    {
      ...fields,
      sourceKind: 'derived',
      eventType: draft.input.eventType,
      source: draft.input.source,
      unitId: draft.unitId,
      assetId: null,
    },
    open,
  );
  if (Object.keys(fill.basis).length === 0) return { fields, columns: {} };
  const { impactCodeId } = fill.values;
  return {
    fields: prepareCreate({
      ...draft.input,
      classification: {
        ...draft.input.classification,
        ...filledClassification(fill),
      },
    }),
    columns: {
      ...(impactCodeId ? { impactCodeId } : {}),
      classificationBasis: withRuleBasis(null, fill),
    },
  };
}
