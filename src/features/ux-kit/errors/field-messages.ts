import { looksLikeRawId } from '../labels/assert-no-raw-id';
import { fieldLabel } from './field-label';
import { humanizeEnumMessage, vocabularyEntry, type FieldVocabulary } from './field-vocabulary';

/** One refused value of a request: the server's field path, its plain label and what is wrong with it. */
export interface FieldMessage {
  /** the server path (`lines[0].quantity`), so a form can tell which of them it shows on an input */
  field: string;
  label: string;
  message: string;
  /** a property the server does not accept at all (whitelist refusal): the form sent a field it should not */
  unexpected: boolean;
}

/** Label of a whitelist refusal: "Unexpected field: xyz", so a tester can report the exact property. */
export const UNEXPECTED_FIELD_LABEL = 'Unexpected field';

const GENERATED = /^(api )?request failed with status|^validation failed\b|^internal server error$|^http \d{3}/i;
const CODE_LIKE = /^[A-Z0-9_]+$/;
const POLICY_REF = /\b[a-z]+(?:_[a-z]+)+@\d+/;
const WHITELIST = /^property (\S+) should not exist$/;

/** True for a sentence a person can read: not a code, not generated status text, no internal id. */
export function isHumanMessage(text: string | null, code: string | null = null): text is string {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 300 || trimmed === code) return false;
  if (CODE_LIKE.test(trimmed) || GENERATED.test(trimmed) || POLICY_REF.test(trimmed)) return false;
  return !looksLikeRawId(trimmed);
}

export const sentence = (text: string) => {
  const trimmed = text.trim().replace(/^Error:\s*/, '');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function unexpectedField(field: string): FieldMessage {
  return { field, label: UNEXPECTED_FIELD_LABEL, message: field, unexpected: true };
}

/**
 * The reason of a refused field without the field name, as a sentence; enum lists read with the form's choice
 * labels (`vocabulary`), else humanized — never raw keys.
 */
export function fieldReason(field: string, message: string, vocabulary?: FieldVocabulary): string {
  const text = message.trim();
  const stripped = text.startsWith(`${field} `) ? text.slice(field.length + 1) : text;
  const label = vocabularyEntry(vocabulary, field)?.label ?? fieldLabel(field);
  const withoutField = field && label ? stripped.replace(new RegExp(`(?<![\\w.])${escapeRegExp(field)}(?![\\w])`, 'g'), label) : stripped;
  const choices = humanizeEnumMessage(withoutField, vocabularyEntry(vocabulary, field)?.values);
  if (choices) return choices;
  return isHumanMessage(withoutField) ? sentence(withoutField) : 'Is not valid';
}

/** A v2 field error (`{ field, message, constraint }`), named with the form's own label when it has one. */
export function fieldMessage(field: string, message: string, constraint?: string, vocabulary?: FieldVocabulary): FieldMessage {
  const text = message.trim();
  const extra = WHITELIST.exec(text);
  if (constraint === 'whitelistValidation' || extra) return unexpectedField(field || extra?.[1] || '');
  return {
    field,
    label: vocabularyEntry(vocabulary, field)?.label ?? (fieldLabel(field) || 'Value'),
    message: fieldReason(field, text, vocabulary),
    unexpected: false,
  };
}

/** Legacy class-validator text of a v1 400: "property x should not exist", "quantity must be positive". */
export function legacyFieldMessage(text: string, vocabulary?: FieldVocabulary): FieldMessage {
  const extra = WHITELIST.exec(text.trim());
  if (extra) return unexpectedField(extra[1]);
  const [field, ...rest] = text.trim().split(' ');
  if (rest.length === 0) return { field: '', label: 'Value', message: 'Is not valid', unexpected: false };
  return fieldMessage(field, rest.join(' '), undefined, vocabulary);
}

/** The messages a form does not show on one of its inputs (whitelist refusals are never on an input). */
export function unshownFieldMessages(messages: readonly FieldMessage[], shown: (rootField: string) => boolean): FieldMessage[] {
  return messages.filter((entry) => entry.unexpected || !shown(entry.field.split(/[.[]/)[0]));
}
