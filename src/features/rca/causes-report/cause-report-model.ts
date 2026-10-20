import type { RcaCauseReportQuery, RcaCauseReportSort } from '@/api/v2/types/rca-cause-report';
import { RCA_CAUSE_KINDS, type RcaCauseKind } from '@/api/v2/types/rca-causes';

export const ALL_KINDS = 'all';

/** Choices of the recurring-cause ranking (item 1.1); the ranking and the amounts are the server's. */
export interface CauseReportFilters {
  kind: RcaCauseKind | typeof ALL_KINDS;
  /** '' = every unit of your scope */
  unitId: string;
  sort: RcaCauseReportSort;
}

export const KIND_LABELS: Readonly<Record<CauseReportFilters['kind'], string>> = {
  all: 'All kinds',
  root: 'Root causes',
  direct: 'Direct causes',
  contributing: 'Contributing causes',
};

export const SORT_LABELS: Readonly<Record<RcaCauseReportSort, string>> = {
  cases: 'Number of investigations',
  approvedLoss: 'Approved loss',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isKind = (value: string | null): value is RcaCauseKind => RCA_CAUSE_KINDS.some((kind) => kind === value);

export function filtersFromParams(params: URLSearchParams): CauseReportFilters {
  const kind = params.get('kind');
  const unitId = params.get('unitId') ?? '';
  return {
    kind: isKind(kind) ? kind : ALL_KINDS,
    unitId: UUID.test(unitId) ? unitId : '',
    sort: params.get('sort') === 'approvedLoss' ? 'approvedLoss' : 'cases',
  };
}

/** Only the choices that differ from the defaults, so the plain ranking keeps a clean URL. */
export function paramsFromFilters(filters: CauseReportFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.kind !== ALL_KINDS) params.kind = filters.kind;
  if (filters.unitId) params.unitId = filters.unitId;
  if (filters.sort !== 'cases') params.sort = filters.sort;
  return params;
}

/** The server query; the money column follows the user's display currency (USD by default). */
export function causeReportQuery(filters: CauseReportFilters, currency: string): RcaCauseReportQuery {
  return {
    ...(filters.kind === ALL_KINDS ? {} : { kind: filters.kind }),
    ...(filters.unitId ? { unitId: filters.unitId } : {}),
    sort: filters.sort,
    currency: currency === 'IRR' ? 'IRR' : 'USD',
  };
}

/** The investigations behind a cause code (the RCA list filtered on the server by `causeCodeId`). */
export function causeCasesHref(causeCodeId: string): string {
  return `/rca?${new URLSearchParams({ causeCodeId }).toString()}`;
}
