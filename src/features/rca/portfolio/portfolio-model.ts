import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import type { RcaPortfolioCauseKind, RcaPortfolioQuery } from '@/api/v2/types/rca-portfolio';

/** Windows of the portfolio (days back from now); the server counts a case by its opening. */
export const WINDOW_DAYS = [30, 90, 180, 365] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];
const DEFAULT_WINDOW: WindowDays = 90;

export const PORTFOLIO_KIND_LABELS: Readonly<Record<RcaPortfolioCauseKind, string>> = {
  root: 'Root causes',
  direct: 'Direct causes',
  contributing: 'Contributing causes',
};

export const WINDOW_LABELS: Readonly<Record<WindowDays, string>> = {
  30: 'Opened in the last 30 days',
  90: 'Opened in the last 90 days',
  180: 'Opened in the last 180 days',
  365: 'Opened in the last 365 days',
};

/** Choices of the portfolio page (item 2.1), kept in the URL; every figure is the server's. */
export interface PortfolioFilters {
  days: WindowDays;
  causeKind: RcaPortfolioCauseKind;
  /** '' = every unit of your scope */
  unitId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isKind = (value: string | null): value is RcaPortfolioCauseKind => value === 'root' || value === 'direct' || value === 'contributing';

const daysOf = (value: string | null): WindowDays => WINDOW_DAYS.find((days) => String(days) === value) ?? DEFAULT_WINDOW;

export function portfolioFiltersFromParams(params: URLSearchParams): PortfolioFilters {
  const kind = params.get('causeKind');
  const unitId = params.get('unitId') ?? '';
  return {
    days: daysOf(params.get('days')),
    causeKind: isKind(kind) ? kind : 'root',
    unitId: UUID.test(unitId) ? unitId : '',
  };
}

/** Only the choices that differ from the defaults, so the plain portfolio keeps a clean URL. */
export function paramsFromPortfolioFilters(filters: PortfolioFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.days !== DEFAULT_WINDOW) params.days = String(filters.days);
  if (filters.causeKind !== 'root') params.causeKind = filters.causeKind;
  if (filters.unitId) params.unitId = filters.unitId;
  return params;
}

/** The server query: a rolling window ending now (minute-stable), money in the display currency (USD default). */
export function portfolioQuery(filters: PortfolioFilters, currency: string, nowMs?: number): RcaPortfolioQuery {
  return {
    ...rollingWindow(filters.days * DAY_MS, nowMs),
    causeKind: filters.causeKind,
    currency: currency === 'IRR' ? 'IRR' : 'USD',
    ...(filters.unitId ? { unitIds: [filters.unitId] } : {}),
  };
}

/** The investigations behind a cause code (the RCA list filtered on the server); null for the Uncoded row. */
export function portfolioCasesHref(causeCodeId: string | null): string | null {
  return causeCodeId ? `/rca?${new URLSearchParams({ causeCodeId }).toString()}` : null;
}

/** One investigation; `tab` opens its actions or its links (loss lines and events). */
export function caseHref(caseId: string, tab?: 'actions' | 'links'): string {
  return tab ? `/rca/${encodeURIComponent(caseId)}/${tab}` : `/rca/${encodeURIComponent(caseId)}`;
}
