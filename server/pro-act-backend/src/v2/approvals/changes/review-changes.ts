import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../../../accounting/entities/accounting-revision.entity';
import { ProductionPeriod } from '../../../periods/entities/production-period.entity';
import { AccountingPoliciesService } from '../../../periods/accounting-policies.service';
import { PeriodChangeProposal } from '../../../reconciliation/entities/period-change-proposal.entity';
import { loadRevisionState } from '../../../reconciliation/revision-state';
import { figuresOf } from '../../../reconciliation/restatement-figures';
import {
  approvedValuesPart,
  ProposalValues as RevisionValues,
} from '../../../reconciliation/proposal-values';
import { RevisionState } from '../../../reconciliation/revision-state';
import {
  RestatementDelta,
  restatementDelta,
  ReviewedFigures,
} from '../../../domain/reconciliation/restatement-delta';
import { ChangeRow, ChangeSource, FieldSpec } from './change-types';

const FIGURE_LABELS: Readonly<Record<string, string>> = {
  target: 'Target',
  actual: 'Actual',
  attributed: 'Attributed',
  residual: 'Unaccounted',
  gap: 'Gap',
  toleranceAdjustment: 'Tolerance adjustment',
  gross: 'Gross production',
  good: 'Good production',
  reject: 'Rejected',
};
const ORDER = Object.keys(FIGURE_LABELS);
const EMPTY: ReviewedFigures = { slices: [], actuals: [], lines: [] };

interface Sides {
  after: ChangeRow;
  before: ChangeRow;
  specs: FieldSpec[];
}

function addFigure(
  sides: Sides,
  key: string,
  spec: FieldSpec,
  figure: { old: string | null; new: string | null },
): void {
  sides.after[key] = figure.new;
  sides.before[key] = figure.old;
  sides.specs.push({ ...spec, key });
}

/**
 * Totals per unit (target, actual, attributed, Unaccounted, …), actuals and the changed loss lines of a
 * restatement delta — the same reviewed figures the approver signs (`figuresOf`).
 */
export function deltaSides(delta: RestatementDelta): Sides {
  const sides: Sides = { after: {}, before: {}, specs: [] };
  for (const group of [...delta.totals, ...delta.actuals]) {
    const figures = Object.entries(group.figures).sort(
      ([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b),
    );
    for (const [name, figure] of figures) {
      const label = FIGURE_LABELS[name] ?? name;
      addFigure(
        sides,
        `figure:${group.uom ?? '-'}:${name}`,
        { key: '', label, format: 'quantity', unit: group.uom ?? undefined },
        figure,
      );
    }
  }
  delta.lines.forEach((line, index) => {
    const spec: FieldSpec = {
      key: '',
      label: `Loss line · ${line.kind}`,
      format: 'quantity',
      unit: line.uom ?? undefined,
      ...(line.reasonCodeId
        ? { labelRef: { ref: 'reason-code' as const, id: line.reasonCodeId } }
        : {}),
    };
    addFigure(sides, `line:${index}`, spec, line);
  });
  return sides;
}

/**
 * QA audit 2026-10-19 (P-2): the loss value of each side in its own default valuation view, one row per
 * currency, so a value-only restatement (quantities unchanged) shows what it changes.
 */
export function addValueRows(
  sides: Sides,
  before: RevisionValues | undefined,
  after: RevisionValues | undefined,
): void {
  const currencies = [
    ...new Set(
      [...(before?.amounts ?? []), ...(after?.amounts ?? [])].map(
        (a) => a.currency,
      ),
    ),
  ];
  for (const currency of currencies) {
    const amount = (values: RevisionValues | undefined) =>
      values?.amounts.find((a) => a.currency === currency)?.amount ?? null;
    addFigure(
      sides,
      `value:${currency}`,
      {
        key: '',
        label: 'Loss value (default valuation view)',
        format: 'money',
        currency: () => currency,
        group: 'value',
      },
      { old: amount(before), new: amount(after) },
    );
  }
}

const valuesOf = (state: RevisionState | null) =>
  state ? approvedValuesPart(state).values : undefined;

/** A revision in review / an approved restatement against the approved revision it supersedes. */
export async function loadPeriodChanges(
  manager: EntityManager,
  policies: AccountingPoliciesService,
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const sources: ChangeSource[] = [];
  for (const id of ids) {
    const revision = await manager.findOneBy(AccountingRevision, {
      id,
      tenantId,
    });
    if (!revision) continue;
    const period = await manager.findOneByOrFail(ProductionPeriod, {
      id: revision.periodId,
      tenantId,
    });
    const superseded = revision.supersedesId
      ? await manager.findOneBy(AccountingRevision, {
          id: revision.supersedesId,
          tenantId,
        })
      : null;
    const afterState = await loadRevisionState(
      manager,
      period,
      revision,
      policies,
    );
    const beforeState = superseded
      ? await loadRevisionState(manager, period, superseded, policies)
      : null;
    const sides = deltaSides(
      restatementDelta(
        beforeState ? figuresOf(beforeState) : EMPTY,
        figuresOf(afterState),
      ),
    );
    addValueRows(sides, valuesOf(beforeState), valuesOf(afterState));
    sources.push({
      id,
      after: sides.after,
      before: superseded ? sides.before : null,
      specs: sides.specs,
      beforeLabel: superseded
        ? `Approved revision ${superseded.revision}`
        : undefined,
      afterLabel: `Revision ${revision.revision}`,
    });
  }
  return sources;
}

type Slices = ReviewedFigures['slices'];
const slicesOf = (snapshot: Record<string, unknown> | null): Slices =>
  Array.isArray(snapshot?.slices) ? (snapshot.slices as Slices) : [];

interface ProposalValues {
  amounts?: Array<{ currency: string; amount: string | null }>;
}

function codingSpecs(
  sides: Sides,
  after: Record<string, unknown> | null,
): void {
  const changes = Array.isArray(after?.codingChanges)
    ? (after.codingChanges as Array<{
        kind: string;
        before: string | null;
        after: string | null;
      }>)
    : [];
  changes.forEach((change, index) => {
    const key = `coding:${index}`;
    sides.before[key] = change.before;
    sides.after[key] = change.after;
    sides.specs.push({
      key,
      label: `Cause reason · ${change.kind} line`,
      ref: 'reason-code',
    });
  });
}

function proposalSource(proposal: PeriodChangeProposal): ChangeSource {
  const pendingAfter = proposal.after;
  const sides = deltaSides(
    restatementDelta(
      { ...EMPTY, slices: slicesOf(proposal.before) },
      { ...EMPTY, slices: slicesOf(pendingAfter ?? proposal.before) },
    ),
  );
  const values =
    (proposal.before.values as ProposalValues | undefined)?.amounts ?? [];
  values.forEach((value) => {
    const key = `value:${value.currency}`;
    sides.before[key] = value.amount;
    sides.after[key] = null;
    sides.specs.push({
      key,
      label: 'Loss value (approved, default view)',
      format: 'money',
      currency: () => value.currency,
      group: 'value',
      informational: true,
    });
  });
  codingSpecs(sides, pendingAfter);
  if (!pendingAfter) {
    return {
      id: proposal.id,
      after: sides.before,
      before: null,
      specs: sides.specs,
      mode: 'full',
      afterLabel: 'Approved figures (new figures are calculated on accept)',
    };
  }
  return {
    id: proposal.id,
    after: sides.after,
    before: sides.before,
    specs: sides.specs,
    beforeLabel: 'Approved',
    afterLabel: 'With the new inputs',
  };
}

/** Before (approved) and after (new inputs with the approved decisions) of open change proposals. */
export async function loadProposalChanges(
  manager: EntityManager,
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const proposals = await manager
    .createQueryBuilder(PeriodChangeProposal, 'r')
    .where('r.tenantId = :tenantId', { tenantId })
    .andWhere('r.id IN (:...ids)', { ids })
    .getMany();
  return proposals.map(proposalSource);
}
