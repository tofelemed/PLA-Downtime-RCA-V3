import type { ErrorMessage } from './error-message';

/** Finance (valuation policy, FX rates) and code library refusals not covered by the shared maps. */
export const CODES_FINANCE_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  CURRENCY_UNDECIDED: {
    title: 'This version has no reporting currency',
    text: 'Create a new version that lists the reporting currencies, then approve that one.',
  },
  CURRENCY_NOT_REPORTED: { title: 'This currency is not a reporting currency', text: 'Choose one of the reporting currencies of the plant.' },
  CURRENCY_UNMAPPED: { title: 'No exchange rate for this currency', text: 'Add and approve an exchange rate for it.' },
};
