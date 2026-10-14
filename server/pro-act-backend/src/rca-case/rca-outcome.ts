import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { EffectivenessVerdict } from '../domain/rca/effectiveness';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { approvedImpact, ApprovedImpact } from './approved-impact';

/** RCA03 outcome of a case: three numbers that are never added or netted, plus the CA2 verdicts. */
export interface RcaOutcomeV2View {
  rcaId: string;
  /** approved historical loss of the linked events and loss lines (ledger, approved revisions only) */
  approvedHistoricalLoss: ApprovedImpact;
  /** the action owners' claims, per currency */
  claimedAvoided: Array<{ currency: string; amount: string; actions: number }>;
  /** what verification observed after each evaluated action vs its baseline */
  realized: Array<{
    actionId: string;
    title: string;
    metric: string;
    expected: string;
    observed: string;
    difference: string;
    /** CA2 verdict (null for baselines typed before CA3) */
    verdict: EffectivenessVerdict | null;
  }>;
  note: string;
}

const OUTCOME_NOTE =
  'Claimed avoided loss (owners), approved historical loss (ledger) and realized difference (verification ' +
  'vs baseline) are separate figures with different bases; they are never added together.';

/** Approved loss of the linked events plus linked loss lines that are not caused by a linked event. */
async function approvedOf(
  manager: EntityManager,
  tenantId: string,
  links: { eventIds: string[]; lineIds: string[] },
): Promise<ApprovedImpact> {
  const { eventIds, lineIds } = links;
  if (lineIds.length === 0)
    return approvedImpact(manager, tenantId, { eventIds });
  const extra: Array<{ id: string }> = await manager.query(
    `SELECT "id"::text AS "id" FROM "loss_lines" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])
        AND ("cause_event_id" IS NULL OR NOT ("cause_event_id" = ANY($3::uuid[])))`,
    [tenantId, lineIds, eventIds],
  );
  const own: Array<{ id: string }> = eventIds.length
    ? await manager.query(
        `SELECT "id"::text AS "id" FROM "loss_lines" WHERE "tenant_id" = $1 AND "cause_event_id" = ANY($2::uuid[])`,
        [tenantId, eventIds],
      )
    : [];
  return approvedImpact(manager, tenantId, {
    lineIds: [...own, ...extra].map((row) => row.id),
  });
}

function claimsOf(actions: RcaAction[]): RcaOutcomeV2View['claimedAvoided'] {
  const sums = new Map<string, { amount: Dec; actions: number }>();
  for (const action of actions) {
    if (action.claimedAvoidedLoss === null || !action.claimedCurrency) continue;
    const entry = sums.get(action.claimedCurrency) ?? {
      amount: new Dec(0),
      actions: 0,
    };
    sums.set(action.claimedCurrency, {
      amount: entry.amount.plus(new Dec(action.claimedAvoidedLoss)),
      actions: entry.actions + 1,
    });
  }
  return [...sums.entries()].map(([currency, entry]) => ({
    currency,
    amount: formatDec(entry.amount),
    actions: entry.actions,
  }));
}

/** The outcome of a case already checked to be in the caller's scope. */
export async function caseOutcome(
  manager: EntityManager,
  input: { tenantId: string; rcaId: string },
): Promise<RcaOutcomeV2View> {
  const links: Array<{ link_type: string; target_id: string }> =
    await manager.query(
      `SELECT "link_type"::text AS "link_type", "target_id" FROM "rca_case_links"
      WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "link_type" IN ('event', 'loss_line')`,
      [input.tenantId, input.rcaId],
    );
  const ids = (type: string) =>
    links.filter((l) => l.link_type === type).map((l) => l.target_id);
  const actions = await manager
    .getRepository(RcaAction)
    .find({ where: { tenantId: input.tenantId, rcaId: input.rcaId } });
  return {
    rcaId: input.rcaId,
    approvedHistoricalLoss: await approvedOf(manager, input.tenantId, {
      eventIds: ids('event'),
      lineIds: ids('loss_line'),
    }),
    claimedAvoided: claimsOf(actions),
    realized: actions.flatMap((action) =>
      action.postAction
        ? [
            {
              actionId: action.id,
              title: action.title,
              ...action.postAction.realized,
              verdict: action.postAction.effectiveness?.verdict ?? null,
            },
          ]
        : [],
    ),
    note: OUTCOME_NOTE,
  };
}
