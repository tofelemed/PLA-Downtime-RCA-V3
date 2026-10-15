import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import {
  BadActorGroup,
  BadActorRank,
  BadActorTrigger,
  rankBadActors,
} from '../../domain/rca/bad-actor';
import { DefaultBasis } from '../../domain/valuation/valuation.types';
import { ReportScope } from './report-scope';
import {
  quantities,
  QuantityRow,
  rankingUom,
  stops,
  StopRow,
  values,
  ValueRow,
} from './bad-actor-sql';

export interface BadActorValueView {
  currency: string;
  /** decimal string; null when nothing is valued or an approved FX rate is missing (never zero) */
  amount: string | null;
  status: 'valued' | 'unvalued' | 'mixed';
  /** SME V7: includes provisional-rate conversions */
  fxProvisional: boolean;
}

export interface BadActorItemView {
  rank: number;
  key: string;
  assetId: string;
  assetCode: string | null;
  assetName: string | null;
  unitId: string | null;
  /** failure_mode grouping: the normalized CA8 mode identity (`mode:…` or `reason:<id>`), else null */
  failureMode: string | null;
  stops: number;
  downtimeSeconds: string;
  /** approved lost quantity per unit of measure */
  quantities: Array<{ uom: string | null; quantity: string }>;
  /** approved lost quantity in the ranking unit of measure; null when none is approved */
  quantity: string | null;
  value: BadActorValueView | null;
  trigger: BadActorTrigger & {
    firedAt: string | null;
    rcaId: string | null;
    outcome: string | null;
  };
}

export interface BadActorFigures {
  key: string;
  quantity: string | null;
  amount: string | null;
  stops: number;
  quantityRows: QuantityRow[];
  value: ValueRow | null;
  stop: StopRow | null;
}

interface Ranking {
  group: BadActorGroup;
  rank: BadActorRank;
  limit: number;
  view: DefaultBasis;
  currency: string;
}

/** The candidate keys of the chosen ranking, cut to `limit` in SQL (bounded, server-side). */
async function rankedKeys(
  manager: EntityManager,
  scope: ReportScope,
  input: Ranking & { uom: string | null },
): Promise<string[]> {
  const selection = { keys: null, limit: input.limit, group: input.group };
  if (input.rank === 'stops')
    return (await stops(manager, scope, selection)).map((r) => r.group_key);
  if (input.rank === 'value')
    return (
      await values(manager, scope, {
        ...selection,
        view: input.view,
        currency: input.currency,
      })
    ).map((r) => r.group_key);
  const rows = await quantities(manager, scope, {
    ...selection,
    uom: input.uom,
  });
  return rows.map((r) => r.group_key);
}

/**
 * CA8 figures of the top keys: ranked in SQL on the chosen metric, then every metric of those keys
 * fetched by key and ordered again in the domain (`rankBadActors`), so the response order is stable.
 */
export async function badActorFigures(
  manager: EntityManager,
  scope: ReportScope,
  input: Ranking,
): Promise<{ figures: BadActorFigures[]; uom: string | null }> {
  const uom = await rankingUom(manager, scope, input.group);
  const keys = await rankedKeys(manager, scope, { ...input, uom });
  if (keys.length === 0) return { figures: [], uom };
  const selection = { keys, limit: null, group: input.group };
  const [qty, value, stop] = await Promise.all([
    quantities(manager, scope, selection),
    values(manager, scope, {
      ...selection,
      view: input.view,
      currency: input.currency,
    }),
    stops(manager, scope, selection),
  ]);
  const figures = keys.map((key) => {
    const quantityRows = qty.filter((r) => r.group_key === key);
    const own = value.find((r) => r.group_key === key) ?? null;
    const stopRow = stop.find((r) => r.group_key === key) ?? null;
    return {
      key,
      quantity: quantityRows.find((r) => r.uom === uom)?.quantity ?? null,
      amount: own?.amount ?? null,
      stops: stopRow?.stops ?? 0,
      quantityRows,
      value: own,
      stop: stopRow,
    };
  });
  return { figures: rankBadActors(figures, input.rank, input.limit), uom };
}

export function valueView(row: ValueRow | null): BadActorValueView | null {
  if (!row) return null;
  return {
    currency: row.currency,
    amount: row.amount,
    status:
      row.valued === 0
        ? 'unvalued'
        : row.unvalued + row.fx_missing === 0
          ? 'valued'
          : 'mixed',
    fxProvisional: row.fx_provisional > 0,
  };
}

/** Whole seconds of a stop row (0 without incidents). */
export const secondsOf = (row: StopRow | null) =>
  formatDec((toDec(row?.seconds ?? null) ?? new Dec(0)).toDecimalPlaces(0));
