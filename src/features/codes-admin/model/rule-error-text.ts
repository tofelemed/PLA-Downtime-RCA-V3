/**
 * Plain-language text for the rule validator's field errors (QA re-test N1): the builder never shows the
 * schema validator's wording ("must be equal to one of the allowed values: physicalType, …") or internal
 * keys; each part of a row gets the instruction the user can act on.
 */
export interface RowContent {
  field: string;
  op?: string;
  value: string;
}

/** Validator wording that leaks the schema (allowed-value lists, lengths, types, patterns). */
const SCHEMA_WORDING = /must be equal to one of|allowed values|must NOT have|must have required property|must match pattern|must be (string|integer|object|array|boolean)|one of:/i;

const isBlank = (text: string | undefined): boolean => (text ?? '').trim() === '';

function sentence(message: string): string {
  const trimmed = message.trim();
  if (trimmed === '') return trimmed;
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

function valueText(message: string, row: RowContent | undefined): string {
  if (isBlank(row?.value)) return 'Enter a value.';
  if (/must be (a )?number/i.test(message)) return 'Enter a number.';
  if (/one of/i.test(message)) return 'Choose one of the offered values.';
  return SCHEMA_WORDING.test(message) ? 'Enter a valid value.' : sentence(message);
}

/** The message for one part of a condition or action row (`field`, `op`, `value`, `set`, `flag`). */
export function plainPartMessage(part: string | undefined, message: string, row: RowContent | undefined): string {
  switch (part) {
    case 'field':
      return isBlank(row?.field) ? 'Choose a field.' : 'Choose a field from the list.';
    case 'op':
      return isBlank(row?.op) ? 'Choose an operator.' : 'Choose an operator that works with this field.';
    case 'value':
      return valueText(message, row);
    case 'set':
      return isBlank(row?.field) ? 'Choose the field to set.' : 'Choose a field to set from the list.';
    case 'flag':
      return isBlank(row?.value) ? 'Enter a flag.' : 'Enter a valid flag.';
    default:
      return SCHEMA_WORDING.test(message) ? 'Complete this row.' : sentence(message);
  }
}

const GENERAL_LABELS: Readonly<Record<string, string>> = { when: 'Conditions', then: 'Actions' };

/** An error about the whole definition (not a row): "Conditions: has 22 conditions." */
export function plainGeneralMessage(field: string, message: string): string {
  const path = field.replace(/^definition\.?/, '');
  const label = GENERAL_LABELS[path.split('.')[0] ?? ''] ?? 'Rule';
  const text = SCHEMA_WORDING.test(message) ? 'is not complete' : message.trim();
  return `${label}: ${text}${/[.!?]$/.test(text) ? '' : '.'}`;
}

/** A row nobody has touched yet (every picker and the value empty). */
export const isPristineRow = (row: RowContent): boolean => isBlank(row.field) && isBlank(row.op) && isBlank(row.value);
