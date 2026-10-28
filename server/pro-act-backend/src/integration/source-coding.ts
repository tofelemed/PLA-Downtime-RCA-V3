import { FactValue } from '../production-event/revisions/event-facts';
import { SourceCoding } from '../production-event/revisions/source-coding-review';

/** Text of a delivered code value: a string, or the Name of a digital state. */
export function codeTokenOf(value: FactValue | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && !Array.isArray(value) && typeof value === 'object') {
    const name = (value as Record<string, unknown>).name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  }
  return null;
}

/**
 * The reason a delivery coded its event as (F2): the code id the resolver matched (null when unresolved)
 * and the raw token. Handed to a source revision beside the facts, never inside them.
 */
export function sourceCodingOf(
  dto: Readonly<Record<string, unknown>>,
  reason: FactValue | undefined,
): SourceCoding {
  return {
    reasonCodeId:
      typeof dto.reasonCodeId === 'string' ? dto.reasonCodeId : null,
    reasonToken: codeTokenOf(reason),
  };
}
