import { Dec, formatDec } from '../../domain/actuals/decimal';
import {
  EFFECTIVENESS_VERDICTS,
  EffectivenessVerdict,
} from '../../domain/rca/effectiveness';
import {
  BASELINE_METRICS,
  BaselineMetric,
} from '../../domain/rca/rca-verification';

/** A case of a portfolio page as read from `rcas`. */
export interface PortfolioCaseFact {
  id: string;
  title: string;
  status: string | null;
  createdAt: string;
}

/** An action of a portfolio page as read from `rca_actions` (decimals as strings). */
export interface PortfolioActionFact {
  rcaId: string;
  status: string;
  /** the one overdue rule of `GET /v2/rca-actions` (`actionOverdueSql`) */
  overdue: boolean;
  claimed: string | null;
  claimedCurrency: string | null;
  verdict: string | null;
  realized: { metric: string; difference: string } | null;
  evaluatedAt: string | null;
}

export interface PortfolioCaseCounts {
  total: number;
  /** cases per status, in status order */
  byStatus: Array<{ status: string; count: number }>;
  /** the newest cases of the row (drill to the case, its actions and its loss lines) */
  sample: Array<{ id: string; title: string; status: string | null }>;
}

export interface PortfolioActionCounts {
  total: number;
  /** open or in progress (overdue ones included) */
  open: number;
  overdue: number;
  done: number;
  cancelled: number;
}

export interface PortfolioVerdictCounts {
  effective: number;
  notEffective: number;
  insufficientEvidence: number;
  /** actions not cancelled that have no verdict yet */
  pending: number;
}

/** The owners' claims in one currency (never converted, never added to approved or realised figures). */
export interface PortfolioClaim {
  currency: string;
  amount: string;
  actions: number;
}

/** Realised difference of one verification metric (not money: recurrences or downtime seconds). */
export interface PortfolioRealized {
  metric: BaselineMetric;
  /** expected − observed, summed over the latest evaluated action per case */
  difference: string;
  cases: number;
}

export interface PortfolioFigures {
  cases: PortfolioCaseCounts;
  actions: PortfolioActionCounts;
  effectiveness: PortfolioVerdictCounts;
  claimedAvoided: PortfolioClaim[];
  /** actions whose claim is in another currency than the one asked for (not converted) */
  claimsInOtherCurrencies: number;
  realized: PortfolioRealized[];
}

const SAMPLE_SIZE = 5;
const UNSET_STATUS = 'Draft';
const OPEN_STATUSES = new Set(['open', 'in_progress']);

const VERDICT_KEYS: Readonly<
  Record<EffectivenessVerdict, keyof PortfolioVerdictCounts>
> = {
  effective: 'effective',
  not_effective: 'notEffective',
  insufficient_evidence: 'insufficientEvidence',
};

const isVerdict = (value: string | null): value is EffectivenessVerdict =>
  EFFECTIVENESS_VERDICTS.some((verdict) => verdict === value);

const isMetric = (value: string): value is BaselineMetric =>
  BASELINE_METRICS.some((metric) => metric === value);

/** Cases of a row by status and its newest cases (each case once). */
export function caseCounts(
  cases: readonly PortfolioCaseFact[],
): PortfolioCaseCounts {
  const byStatus = new Map<string, number>();
  for (const fact of cases) {
    const status = fact.status ?? UNSET_STATUS;
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const newest = [...cases].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  );
  return {
    total: cases.length,
    byStatus: [...byStatus.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => ({ status, count })),
    sample: newest
      .slice(0, SAMPLE_SIZE)
      .map(({ id, title, status }) => ({ id, title, status })),
  };
}

export function actionCounts(
  actions: readonly PortfolioActionFact[],
): PortfolioActionCounts {
  const count = (test: (a: PortfolioActionFact) => boolean) =>
    actions.filter(test).length;
  return {
    total: actions.length,
    open: count((a) => OPEN_STATUSES.has(a.status)),
    overdue: count((a) => a.overdue),
    done: count((a) => a.status === 'done'),
    cancelled: count((a) => a.status === 'cancelled'),
  };
}

export function verdictCounts(
  actions: readonly PortfolioActionFact[],
): PortfolioVerdictCounts {
  const counts: PortfolioVerdictCounts = {
    effective: 0,
    notEffective: 0,
    insufficientEvidence: 0,
    pending: 0,
  };
  for (const action of actions) {
    if (isVerdict(action.verdict)) counts[VERDICT_KEYS[action.verdict]] += 1;
    else if (action.status !== 'cancelled') counts.pending += 1;
  }
  return counts;
}

/**
 * The owners' claims in `currency` (decimal sum, as the case outcome sums them) and how many actions
 * claim in another currency; nothing is converted.
 */
export function claimsIn(
  actions: readonly PortfolioActionFact[],
  currency: string,
): { claimed: PortfolioClaim[]; other: number } {
  let amount = new Dec(0);
  let count = 0;
  let other = 0;
  for (const action of actions) {
    if (action.claimed === null || !action.claimedCurrency) continue;
    if (action.claimedCurrency !== currency) {
      other += 1;
      continue;
    }
    amount = amount.plus(new Dec(action.claimed));
    count += 1;
  }
  const claimed =
    count === 0
      ? []
      : [{ currency, amount: formatDec(amount), actions: count }];
  return { claimed, other };
}

/** The latest evaluated action of each case and metric (two actions of one case observe the same incidents). */
function latestPerCase(
  actions: readonly PortfolioActionFact[],
): PortfolioActionFact[] {
  const latest = new Map<string, PortfolioActionFact>();
  for (const action of actions) {
    if (!action.realized || !isMetric(action.realized.metric)) continue;
    const key = `${action.rcaId}|${action.realized.metric}`;
    const kept = latest.get(key);
    if (!kept || (action.evaluatedAt ?? '') > (kept.evaluatedAt ?? ''))
      latest.set(key, action);
  }
  return [...latest.values()];
}

/** Realised differences per metric, one evaluated action per case and metric. */
export function realizedOf(
  actions: readonly PortfolioActionFact[],
): PortfolioRealized[] {
  const sums = new Map<BaselineMetric, { difference: Dec; cases: number }>();
  for (const action of latestPerCase(actions)) {
    const realized = action.realized;
    if (!realized || !isMetric(realized.metric)) continue;
    const entry = sums.get(realized.metric) ?? {
      difference: new Dec(0),
      cases: 0,
    };
    sums.set(realized.metric, {
      difference: entry.difference.plus(new Dec(realized.difference)),
      cases: entry.cases + 1,
    });
  }
  return BASELINE_METRICS.flatMap((metric) => {
    const entry = sums.get(metric);
    return entry
      ? [
          {
            metric,
            difference: formatDec(entry.difference),
            cases: entry.cases,
          },
        ]
      : [];
  });
}

/**
 * The figures of one portfolio row (item 2.1) from the facts of its cases: counts by status, actions,
 * verdicts, the owners' claims in `currency` and the realised differences — separate figures that are
 * never added together, nor to the approved loss of the row.
 */
export function portfolioFigures(
  rcaIds: readonly string[],
  facts: {
    cases: ReadonlyMap<string, PortfolioCaseFact>;
    actions: readonly PortfolioActionFact[];
  },
  currency: string,
): PortfolioFigures {
  const ids = new Set(rcaIds);
  const cases = [...ids].flatMap((id) => {
    const fact = facts.cases.get(id);
    return fact ? [fact] : [];
  });
  const actions = facts.actions.filter((action) => ids.has(action.rcaId));
  const claims = claimsIn(actions, currency);
  return {
    cases: caseCounts(cases),
    actions: actionCounts(actions),
    effectiveness: verdictCounts(actions),
    claimedAvoided: claims.claimed,
    claimsInOtherCurrencies: claims.other,
    realized: realizedOf(actions),
  };
}
