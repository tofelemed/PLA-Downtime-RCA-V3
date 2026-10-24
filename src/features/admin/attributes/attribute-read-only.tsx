import { ATTRIBUTE_DATA_TYPE_LABELS, ATTRIBUTE_ENTITY_LABELS, labelOf } from '@/features/ux-kit/labels';
import type { AttributeFormValues } from './attribute-form-model';

const orDash = (value: string) => (value.trim() === '' ? '—' : value);

/** The rule lines of a type that has rules (text length / pattern, number limits, choices). */
function ruleFacts(values: AttributeFormValues): Array<[string, string]> {
  if (values.dataType === 'string') {
    return [['Shortest length', orDash(values.minLength)], ['Longest length', orDash(values.maxLength)], ['Pattern', orDash(values.pattern)]];
  }
  if (values.dataType === 'number') return [['Smallest value', orDash(values.minValue)], ['Largest value', orDash(values.maxValue)]];
  if (values.dataType === 'select') return [['Choices', orDash(values.options.split('\n').filter(Boolean).join(', '))]];
  return [];
}

/** A custom attribute the user may not change: its values as text (no disabled inputs). */
export function AttributeReadOnly({ values }: { values: AttributeFormValues }) {
  const facts: Array<[string, string]> = [
    ['Hierarchy level', labelOf(ATTRIBUTE_ENTITY_LABELS, values.entityType)],
    ['Type of value', labelOf(ATTRIBUTE_DATA_TYPE_LABELS, values.dataType)],
    ['Display name', values.displayName],
    ['Internal name', values.name],
    ['Help text', orDash(values.description)],
    ['Default value', orDash(values.defaultValue)],
    ['Position', orDash(values.displayOrder)],
    ['Required', values.isRequired ? 'Yes' : 'No'],
    ['In use', values.isActive ? 'Yes' : 'No'],
    ...ruleFacts(values),
  ];
  return (
    <dl className="grid max-w-3xl gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]" data-testid="attribute-read-only">
      {facts.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
