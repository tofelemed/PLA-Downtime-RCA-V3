import { Dec } from '../actuals/decimal';
import {
  KpiCohort,
  KpiDraft,
  KpiScope,
  RECONCILED_OEE_LABEL,
} from './kpi.types';
import { ratioKpi, unavailable } from './kpi-values';

/** Quantities of KPI04 in one unit of measure: good and the availability / performance / quality losses. */
export interface ReconciledTerms {
  good: Dec | null;
  availabilityLoss: Dec | null;
  performanceLoss: Dec | null;
  qualityLoss: Dec | null;
  uom: string | null;
  /** null = every capacity loss is classified (residual within epsilon); else why the basis is incomplete */
  incompleteReason: string | null;
  /** idle / no-planned-production quantity, disclosed separately (never part of the ratios) */
  excluded: Dec | null;
  provisional: string | null;
}

const METRICS = [
  'reconciled_availability',
  'reconciled_performance',
  'reconciled_quality',
  'reconciled_oee',
] as const;

/** Numerator / denominator pairs of A, P, Q, OEE; null when the loss basis is not fully declared. */
function pairsOf(terms: ReconciledTerms): Array<[Dec, Dec]> | null {
  const { good: G, availabilityLoss: LA } = terms;
  const { performanceLoss: LP, qualityLoss: LQ } = terms;
  if (terms.incompleteReason || !G || !LA || !LP || !LQ) return null;
  const total = G.plus(LA).plus(LP).plus(LQ);
  return [
    [G.plus(LP).plus(LQ), total],
    [G.plus(LQ), G.plus(LP).plus(LQ)],
    [G, G.plus(LQ)],
    [G, total],
  ];
}

/**
 * GE-style reconciled PLA OEE (KPI04): T = G + LA + LP + LQ; A = (G + LP + LQ) / T,
 * P = (G + LQ) / (G + LP + LQ), Q = G / (G + LQ), OEE = G / T. Needs a fully declared loss basis,
 * otherwise every factor is unavailable. Always labelled — never shown as operational OEE.
 */
export function reconciledOee(
  terms: ReconciledTerms,
  scope: KpiScope,
): KpiDraft[] {
  const cohort: KpiCohort = {
    label: RECONCILED_OEE_LABEL,
    uom: terms.uom,
    idleOrNoPlannedProduction: terms.excluded ? terms.excluded.toFixed() : null,
  };
  const pairs = pairsOf(terms);
  if (!pairs) {
    const reason = terms.incompleteReason ?? 'loss_basis_incomplete';
    const none = { numerator: null, denominator: null, cohort };
    return METRICS.map((metric) =>
      unavailable({ metric, scope }, none, reason),
    );
  }
  return METRICS.map((metric, i) =>
    ratioKpi(
      { metric, scope },
      {
        numerator: pairs[i][0],
        denominator: pairs[i][1],
        provisional: terms.provisional,
        cohort,
      },
      'no_production',
    ),
  );
}
