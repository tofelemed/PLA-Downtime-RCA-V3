import { looksLikeRawId } from '../labels/assert-no-raw-id';
import { factsOf, type ErrorFacts } from './error-facts';
import { ERROR_MESSAGES, NETWORK_MESSAGE, statusMessage } from './error-messages';
import { fieldLabel } from './field-label';

/** What support needs to find a failed request; shown only behind "Copy support reference". */
export interface SupportReferenceInfo {
  code: string | null;
  status: number | null;
  correlationId: string | null;
}

/** A failure in plain language: never a code, status number or correlation id in `title` / `message`. */
export interface FriendlyError {
  title: string;
  message: string;
  fieldMessages: ReadonlyArray<{ label: string; message: string }>;
  reference: SupportReferenceInfo | null;
}

const GENERATED = /^(api )?request failed with status|^validation failed:|^internal server error$|^http \d{3}/i;
const CODE_LIKE = /^[A-Z0-9_]+$/;
const POLICY_REF = /\b[a-z]+(?:_[a-z]+)+@\d+/;

/** True for a sentence a person can read: not a code, not generated status text, no internal id. */
export function isHumanMessage(text: string | null, code: string | null = null): text is string {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 300 || trimmed === code) return false;
  if (CODE_LIKE.test(trimmed) || GENERATED.test(trimmed) || POLICY_REF.test(trimmed)) return false;
  return !looksLikeRawId(trimmed);
}

const sentence = (text: string) => {
  const trimmed = text.trim().replace(/^Error:\s*/, '');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/** Title of a refusal: the mapped code, else its HTTP status class. */
export function refusalTitle(code: string | null | undefined, status: number | null | undefined): string {
  return (code ? ERROR_MESSAGES[code]?.title : undefined) ?? statusMessage(status ?? null).title;
}

function messageOf(facts: ErrorFacts): string {
  const mapped = facts.code ? ERROR_MESSAGES[facts.code]?.text : undefined;
  if (mapped) return mapped;
  const serverSide = facts.status !== null && facts.status >= 500;
  if (!serverSide && isHumanMessage(facts.serverMessage, facts.code)) return sentence(facts.serverMessage);
  return statusMessage(facts.status).text;
}

function fieldMessage(field: string, message: string): { label: string; message: string } {
  const withoutField = message.trim().startsWith(`${field} `) ? message.trim().slice(field.length + 1) : message;
  return { label: fieldLabel(field) || 'Value', message: isHumanMessage(withoutField) ? sentence(withoutField) : 'Is not valid' };
}

/** Legacy class-validator text: "property x should not exist", "quantity must be positive". */
function legacyFieldMessage(text: string): { label: string; message: string } {
  const extra = /^property (\S+) should not exist$/.exec(text);
  if (extra) return { label: fieldLabel(extra[1]), message: 'Is not accepted here' };
  const [field, ...rest] = text.split(' ');
  return rest.length > 0 ? fieldMessage(field, rest.join(' ')) : { label: 'Value', message: 'Is not valid' };
}

function referenceOf(facts: ErrorFacts): SupportReferenceInfo | null {
  if (!facts.code && !facts.correlationId && facts.status === null) return null;
  return { code: facts.code, status: facts.status, correlationId: facts.correlationId };
}

/**
 * Plain-language description of any failure (V2ApiError, v1 ApiError, network TypeError, Error, unknown)
 * for alerts and toasts. The code, status and correlation id only go to `reference`.
 */
export function describeError(error: unknown): FriendlyError {
  const facts = factsOf(error);
  if (facts.network) return { title: NETWORK_MESSAGE.title, message: NETWORK_MESSAGE.text, fieldMessages: [], reference: null };
  const fieldMessages = [
    ...facts.fieldErrors.map((entry) => fieldMessage(entry.field, entry.message)),
    ...facts.messageList.map(legacyFieldMessage),
  ];
  return {
    title: refusalTitle(facts.code, facts.status),
    message: messageOf(facts),
    fieldMessages,
    reference: referenceOf(facts),
  };
}
