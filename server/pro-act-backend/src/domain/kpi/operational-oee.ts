import { Dec } from '../actuals/decimal';
import { KpiDraft, KpiScope } from './kpi.types';
import { KpiTerms, ratioKpi, unavailable } from './kpi-values';

/**
 * ISO 22400 time model of KPI01 (seconds): S planned production time after exclusions, D availability-stop
 * time inside S (union), U ideal time for gross, V ideal time for good. U / V are null with a reason when
 * the quantity or the sustained rate is missing (never assumed).
 */
export interface OeeTerms {
  scheduled: Dec;
  stopped: Dec;
  idealGross: Dec | null;
  idealGood: Dec | null;
  /** why U is null */
  grossReason: string | null;
  /** why V is null */
  goodReason: string | null;
  /** incomplete production inputs (P, Q, OEE; A depends on time only) */
  provisional: string | null;
}

/**
 * Operational OEE (KPI01–KPI03): R = S − D, A = R/S, P = U/R, Q = V/U, OEE = V/S. Micro-stop and
 * slowdown time stays in R and shows in P (KPI02); zero or missing denominators give null with a reason;
 * factors above 100 % are kept as exceptions. A·P·Q = OEE whenever all four exist.
 */
export function operationalOee(terms: OeeTerms, scope: KpiScope): KpiDraft[] {
  const S = terms.scheduled;
  const R = S.minus(terms.stopped);
  const U = terms.idealGross;
  const V = terms.idealGood;
  const provisional = terms.provisional;
  const zeroS = 'no_scheduled_time';
  const performanceZero = S.isZero() ? zeroS : 'no_run_time';
  return [
    ratioKpi(
      { metric: 'availability', scope },
      { numerator: R, denominator: S },
      zeroS,
    ),
    ratioKpi(
      { metric: 'performance', scope },
      withReason(U, R, terms.grossReason, provisional),
      performanceZero,
    ),
    qualityKpi(terms, scope),
    ratioKpi(
      { metric: 'oee', scope },
      withReason(V, S, terms.goodReason, provisional),
      zeroS,
    ),
  ];
}

/** Q = V/U: needs both ideal times; only good known → quality_evidence_missing (T41), never 100 %. */
function qualityKpi(terms: OeeTerms, scope: KpiScope): KpiDraft {
  const target = { metric: 'quality' as const, scope };
  const { idealGross: U, idealGood: V } = terms;
  if (V === null) {
    return unavailable(
      target,
      { numerator: null, denominator: U },
      terms.goodReason ?? 'input_missing',
    );
  }
  if (U === null) {
    return unavailable(
      target,
      { numerator: V, denominator: null },
      terms.grossReason ?? 'quality_evidence_missing',
    );
  }
  return ratioKpi(
    target,
    { numerator: V, denominator: U, provisional: terms.provisional },
    'no_production',
  );
}

function withReason(
  numerator: Dec | null,
  denominator: Dec,
  reason: string | null,
  provisional: string | null,
): KpiTerms {
  return {
    numerator,
    denominator,
    reason: reason ?? undefined,
    provisional,
  };
}
