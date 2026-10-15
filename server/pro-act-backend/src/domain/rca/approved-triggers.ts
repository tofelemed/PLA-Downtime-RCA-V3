import { Dec, formatDec } from '../actuals/decimal';
import { productionThreshold, RcaPolicy } from './rca-policy';
import { occurrenceOf, TriggerCandidate } from './rca-triggers';

/** Approved ledger facts of one cause event after a period approval (VA-01b approved lines only). */
export interface ApprovedEventImpact {
  eventId: string;
  occurrenceId: string | null;
  /**
   * approved value per currency in the policy's default view (SME V8: economic impact from valuation
   * policy version 3); amount null while any line is unvalued (never estimated); `provisional` when an
   * authorised provisional FX rate converted some of it (SME V7)
   */
  values: ReadonlyArray<{
    currency: string;
    amount: string | null;
    provisional?: boolean;
  }>;
  /** the valuation view of `values` (recorded on a cost firing) */
  valueView?: string;
  /** approved lost quantity per unit of measure (loss kinds only) */
  lost: ReadonlyArray<{ uom: string | null; quantity: string }>;
  /** the unit's planned quantity of the event's operational day per unit of measure */
  dailyPlan: ReadonlyArray<{ uom: string | null; quantity: string }>;
  criticalAsset: boolean;
  advisory: boolean;
  openCaseId: string | null;
}

interface ApprovedContext {
  policy: RcaPolicy;
  policyRef: { id: string; version: number };
}

function candidate(
  impact: ApprovedEventImpact,
  context: ApprovedContext,
  input: { trigger: 'cost' | 'quantity'; detail: TriggerCandidate['detail'] },
): TriggerCandidate {
  const ref = context.policyRef;
  return {
    trigger: input.trigger,
    source: { kind: 'policy', ...ref },
    idempotencyKey: `policy:${ref.id}@${ref.version}:${input.trigger}:${occurrenceOf(impact)}`,
    provisional: false,
    firedOn: 'approved',
    recommendOnly: impact.advisory,
    ...(impact.openCaseId && context.policy.repeatMatch !== 'asset'
      ? { linkToCaseId: impact.openCaseId }
      : {}),
    detail: { ...input.detail, criticalAsset: impact.criticalAsset },
  };
}

/**
 * D17 money limit (finance): the approved value in the policy currency; never halved, null = off. A value
 * resting on a provisional FX rate is not final money (SME V7): it waits for the final rate, whose
 * restatement then fires once under the same per-occurrence key.
 */
function costCandidate(
  impact: ApprovedEventImpact,
  context: ApprovedContext,
): TriggerCandidate | null {
  const { costThreshold, costCurrency } = context.policy;
  if (costThreshold === null || !costCurrency) return null;
  const value = impact.values.find((entry) => entry.currency === costCurrency);
  if (!value?.amount || value.provisional) return null;
  if (new Dec(value.amount).lt(new Dec(costThreshold))) return null;
  return candidate(impact, context, {
    trigger: 'cost',
    detail: {
      amount: value.amount,
      currency: costCurrency,
      threshold: costThreshold,
      ...(impact.valueView ? { view: impact.valueView } : {}),
    },
  });
}

/** D17 lost tonnes: approved lost quantity vs the share of the daily plan in the same unit of measure. */
function quantityCandidate(
  impact: ApprovedEventImpact,
  context: ApprovedContext,
): TriggerCandidate | null {
  const share = context.policy.lostQuantityShareOfDailyPlan;
  if (share === null) return null;
  const factor = productionThreshold(
    context.policy,
    share,
    impact.criticalAsset,
  );
  for (const lost of impact.lost) {
    const plan = impact.dailyPlan.find((entry) => entry.uom === lost.uom);
    if (!plan || !new Dec(plan.quantity).gt(0)) continue;
    const threshold = new Dec(plan.quantity).mul(factor);
    if (new Dec(lost.quantity).lt(threshold)) continue;
    return candidate(impact, context, {
      trigger: 'quantity',
      detail: {
        lostQuantity: lost.quantity,
        uom: lost.uom,
        dailyPlan: plan.quantity,
        thresholdQuantity: formatDec(threshold),
        share: factor,
      },
    });
  }
  return null;
}

/**
 * D17 triggers on approved impact (pure): the money limit and the share of the daily planned quantity,
 * read from the approved ledger when a period is approved or restated (`firedOn: approved`, never
 * provisional). The key is per occurrence, so a restatement does not fire twice.
 */
export function evaluateApprovedTriggers(
  impact: ApprovedEventImpact,
  context: ApprovedContext,
): TriggerCandidate[] {
  return [
    costCandidate(impact, context),
    quantityCandidate(impact, context),
  ].filter((entry): entry is TriggerCandidate => entry !== null);
}
