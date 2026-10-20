import { CodeDrivenAxis } from '../../code-library/classification-basis';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { keptRuleBasis } from '../../rules/rule-defaults';

/** A PATCH body after the reason code's defaults were applied (only the axes it can fill). */
interface CodedPatch {
  dto: { scheduleClass?: string; oeeComponent?: string };
  columns: Partial<ProductionEvent>;
}

/** An existing impact code is never replaced by a reason default (only an empty one is filled). */
function withoutKeptImpactCode(
  locked: ProductionEvent,
  columns: Partial<ProductionEvent>,
): Partial<ProductionEvent> {
  if (!locked.impactCodeId || columns.impactCodeId === undefined)
    return columns;
  const rest = { ...columns };
  delete rest.impactCodeId;
  return rest;
}

/**
 * The reason-code columns of a PATCH against the locked row: a kept impact code stays, and the
 * `declarative_rule` basis of axes this request does not write survives the new reason code's basis
 * (item 8 open question 2).
 */
export function reasonColumns(
  locked: ProductionEvent,
  coded: CodedPatch,
): Partial<ProductionEvent> {
  const columns = withoutKeptImpactCode(locked, coded.columns);
  if (!('classificationBasis' in columns)) return columns;
  const replaced = new Set<CodeDrivenAxis>();
  if (coded.dto.scheduleClass !== undefined) replaced.add('scheduleClass');
  if (coded.dto.oeeComponent !== undefined) replaced.add('oeeComponent');
  if (columns.impactCodeId !== undefined) replaced.add('impactCodeId');
  return {
    ...columns,
    classificationBasis: keptRuleBasis(
      locked.classificationBasis,
      columns.classificationBasis,
      replaced,
    ),
  };
}
