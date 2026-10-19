import { SetMetadata } from '@nestjs/common';

export const MONEY_ONLY_KEY = 'moneyOnly';
export const MONEY_FIELDS_KEY = 'moneyFields';

/**
 * A route that returns nothing but money (a value report, valuation rates, FX rates, an export with value
 * columns): a caller without the money capability gets 403 MONEY_NOT_VISIBLE before the handler runs.
 */
export const MoneyOnly = () => SetMetadata(MONEY_ONLY_KEY, true);

/**
 * Keys that are money on this route only (generic names such as `cost` or `values`), left out for a caller
 * without the money capability in addition to the shared money rule (`money-redaction.ts`).
 */
export const MoneyFields = (...keys: string[]) =>
  SetMetadata(MONEY_FIELDS_KEY, keys);
