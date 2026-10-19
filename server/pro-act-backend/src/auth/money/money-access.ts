import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';

/**
 * QA re-test decision 2026-10-19 ("Money is withheld on the server for operators"): the operations-only
 * roles see quantities, never valuation figures. Mirrored by the frontend `canViewMoney`
 * (`src/features/auth/capabilities.ts`, pinned by `server-role-sets.test.ts`).
 */
export const MONEY_EXCLUDED_ROLES = ['Operator', 'operator'] as const;

const EXCLUDED: ReadonlySet<string> = new Set(MONEY_EXCLUDED_ROLES);

/**
 * Whether the caller may see money: it holds at least one role in the acting plant that is not an
 * operations-only role. Work without a request context (jobs, CLIs) is system work and keeps the figures.
 */
export function canViewMoney(context: RequestContext | undefined): boolean {
  if (!context) return true;
  if (context.isSuperAdmin) return true;
  return context.roles.some((role) => !EXCLUDED.has(role));
}

export const MONEY_NOT_VISIBLE = 'MONEY_NOT_VISIBLE';

export function moneyNotVisible(): ForbiddenException {
  return new ForbiddenException({
    code: MONEY_NOT_VISIBLE,
    message: 'Your roles in this plant do not include loss values',
  });
}

/** 403 MONEY_NOT_VISIBLE when the request asks for nothing but money (a value report, a value metric). */
export function assertMoneyVisible(context: RequestContext | undefined): void {
  if (!canViewMoney(context)) throw moneyNotVisible();
}
