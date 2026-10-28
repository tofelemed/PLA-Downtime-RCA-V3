import { factsOf, type ErrorFacts } from './error-facts';
import { ERROR_MESSAGES, NETWORK_MESSAGE, statusMessage, type ErrorMessage } from './error-messages';
import { fieldMessage, isHumanMessage, legacyFieldMessage, sentence, type FieldMessage } from './field-messages';
import { variantMessage } from './message-variants';
import type { FieldVocabulary } from './field-vocabulary';

export { isHumanMessage } from './field-messages';
export type { FieldMessage } from './field-messages';

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
  fieldMessages: ReadonlyArray<FieldMessage>;
  reference: SupportReferenceInfo | null;
}

/** Codes that only say "a value was refused": their mapped text needs the field list or the server's reason. */
const GENERIC_VALUE_CODES: ReadonlySet<string> = new Set(['BAD_REQUEST', 'VALIDATION_FAILED', 'REQUEST_FAILED']);

/** A refused value the server did not name: never ask to "check the highlighted values" when nothing is. */
export const UNNAMED_VALUE_TEXT =
  'The server did not say which value. Copy the support reference and include it when you report this.';

/** Only properties the server does not accept were refused: a fault of the screen, not of the person. */
export const UNEXPECTED_FIELDS_TEXT =
  'This screen sent a field the server does not accept. Report the field named below with the support reference.';

/** Title of a refusal: the mapped code, else its HTTP status class. */
export function refusalTitle(code: string | null | undefined, status: number | null | undefined): string {
  return (code ? ERROR_MESSAGES[code]?.title : undefined) ?? statusMessage(status ?? null).title;
}

const isGeneric = (code: string | null) => code === null || GENERIC_VALUE_CODES.has(code);
const isValueRefusal = (facts: ErrorFacts) =>
  (facts.code !== null && GENERIC_VALUE_CODES.has(facts.code)) || facts.status === 400 || facts.status === 422;

/** The server's own reason when it is a sentence a person can read (never for a 5xx). */
function serverReason(facts: ErrorFacts): string | null {
  const serverSide = facts.status !== null && facts.status >= 500;
  return !serverSide && isHumanMessage(facts.serverMessage, facts.code) ? sentence(facts.serverMessage) : null;
}

/**
 * What to do: the mapped text of the code. A generic "value refused" code says it through its field
 * messages; with only unexpected properties it says the screen is at fault; without any it gives the
 * server's own reason (when it is a sentence), else that the server named no value.
 */
function messageOf(facts: ErrorFacts, fields: readonly FieldMessage[]): string {
  const mapped = facts.code ? ERROR_MESSAGES[facts.code]?.text : undefined;
  const generic = isGeneric(facts.code);
  if (fields.length > 0) {
    if (generic && fields.every((entry) => entry.unexpected)) return UNEXPECTED_FIELDS_TEXT;
    return mapped ?? serverReason(facts) ?? statusMessage(facts.status).text;
  }
  if (mapped && !generic) return mapped;
  return serverReason(facts) ?? (isValueRefusal(facts) ? UNNAMED_VALUE_TEXT : statusMessage(facts.status).text);
}

function referenceOf(facts: ErrorFacts): SupportReferenceInfo | null {
  if (!facts.code && !facts.correlationId && facts.status === null) return null;
  return { code: facts.code, status: facts.status, correlationId: facts.correlationId };
}

/**
 * Plain-language description of any failure (V2ApiError, v1 ApiError, network TypeError, Error, unknown)
 * for alerts and toasts. The code, status and correlation id only go to `reference`. `context` is a map
 * of `messages-context.ts` that words a code for one kind of screen (a generic code like
 * TENANT_SCOPE_REQUIRED means something specific on a plant-wide policy form); it wins over the generic map.
 * A property the server does not accept at all is listed as "Unexpected field: <name>". `fields` is the
 * form's vocabulary: refused fields are named with the form's labels and choices (fallback: humanized).
 */
export function describeError(
  error: unknown,
  context?: Readonly<Record<string, ErrorMessage>>,
  fields?: FieldVocabulary,
): FriendlyError {
  const facts = factsOf(error);
  if (facts.network) return { title: NETWORK_MESSAGE.title, message: NETWORK_MESSAGE.text, fieldMessages: [], reference: null };
  const specific = (facts.code ? context?.[facts.code] : undefined) ?? variantMessage(facts);
  const fieldMessages = [
    ...facts.fieldErrors.map((entry) => fieldMessage(entry.field, entry.message, entry.constraint, fields)),
    ...facts.messageList.map((text) => legacyFieldMessage(text, fields)),
  ];
  return {
    title: specific?.title ?? refusalTitle(facts.code, facts.status),
    message: specific?.text ?? messageOf(facts, fieldMessages),
    fieldMessages,
    reference: referenceOf(facts),
  };
}
