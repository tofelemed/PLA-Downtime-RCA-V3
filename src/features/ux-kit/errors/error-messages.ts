import type { ErrorMessage } from './error-message';
import { ACCOUNTING_MESSAGES } from './messages-accounting';
import { ADMIN_MESSAGES } from './messages-admin';
import { ADMINISTRATION_MESSAGES } from './messages-administration';
import { CODES_FINANCE_MESSAGES } from './messages-codes-finance';
import { COMMON_MESSAGES } from './messages-common';
import { MASTER_DATA_MESSAGES } from './messages-master-data';
import { EVENT_MESSAGES } from './messages-events';
import { RCA_MESSAGES } from './messages-rca';

export type { ErrorMessage } from './error-message';

/**
 * The ONE map from a server error code (API03 envelope `code`) to plain-language text. Add a code here,
 * never in a screen; an unmapped code falls back to its HTTP status class (`statusMessage`).
 */
export const ERROR_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  ...COMMON_MESSAGES,
  ...ACCOUNTING_MESSAGES,
  ...ADMIN_MESSAGES,
  ...ADMINISTRATION_MESSAGES,
  ...MASTER_DATA_MESSAGES,
  ...CODES_FINANCE_MESSAGES,
  ...EVENT_MESSAGES,
  ...RCA_MESSAGES,
};

/** No response at all (fetch `TypeError`, offline, CORS, DNS). */
export const NETWORK_MESSAGE: Required<ErrorMessage> = {
  title: 'Cannot reach the server',
  text: 'Check your network connection and try again.',
};

/** Neither a code nor a status (a plain `Error` thrown in the browser). */
export const UNKNOWN_MESSAGE: Required<ErrorMessage> = {
  title: 'Something went wrong',
  text: 'Try again. If it keeps happening, contact support.',
};

const STATUS_MESSAGES: Readonly<Record<number, Required<ErrorMessage>>> = {
  400: { title: 'Some values were not accepted', text: 'Check the highlighted values and try again.' },
  401: { title: 'Your session has ended', text: 'Sign in again to continue.' },
  403: { title: "You don't have permission for this", text: 'Ask a plant administrator if you need access.' },
  404: { title: 'Not found', text: 'It may have been deleted or moved. Reload the page.' },
  409: { title: 'This was changed by someone else', text: 'Reload to see the latest version, then try again.' },
  412: { title: 'This record changed since you opened it', text: 'Reload to see the latest version, then apply your change again.' },
  413: { title: 'The upload is too large', text: 'Send a smaller file or fewer rows at a time.' },
  422: { title: 'Some values were not accepted', text: 'Check the highlighted values and try again.' },
  429: { title: 'Too many requests', text: 'Wait a minute and try again.' },
};

const SERVER_MESSAGE: Required<ErrorMessage> = {
  title: 'The server could not complete the request',
  text: 'Try again. If it keeps happening, contact support.',
};

const CLIENT_MESSAGE: Required<ErrorMessage> = {
  title: 'The request was not accepted',
  text: 'Check your input and try again.',
};

/** Status-class text: 400/422, 401, 403, 404, 409, 412, 413, 429, other 4xx, 5xx; null status → unknown. */
export function statusMessage(status: number | null): Required<ErrorMessage> {
  if (status === null || status <= 0) return UNKNOWN_MESSAGE;
  if (status >= 500) return SERVER_MESSAGE;
  return STATUS_MESSAGES[status] ?? CLIENT_MESSAGE;
}
