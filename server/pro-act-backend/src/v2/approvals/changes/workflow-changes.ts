import { EntityManager, ObjectLiteral } from 'typeorm';
import {
  PlanVersion,
  StoredManualTarget,
} from '../../../plans/entities/plan-version.entity';
import { AccountingPolicy } from '../../../periods/entities/accounting-policy.entity';
import { SourceStatusMapping } from '../../../periods/entities/source-status-mapping.entity';
import { ActualsAdjustment } from '../../../periods/entities/actuals-adjustment.entity';
import { LotDisposition } from '../../../quality-dispositions/entities/lot-disposition.entity';
import { UncertaintyBudget } from '../../../uncertainty/entities/uncertainty-budget.entity';
import { Rule } from '../../../rules/entities/rule.entity';
import { RuleVersion } from '../../../rules/entities/rule-version.entity';
import { Dec, formatDec, toDec } from '../../../domain/actuals/decimal';
import { ChangeRow, ChangeSource, FieldSpec } from './change-types';
import { FamilyKind } from './family-changes';
import { flattenJson, jsonSpecs, pathLabel } from './field-diff';
import { VALIDITY } from './version-changes';

const text = (row: ChangeRow, key: string): string | null =>
  typeof row[key] === 'string' ? row[key] : null;
const uomOf = (row: ChangeRow) => text(row, 'uom');

/** Σ of the manual leaf targets and how many leaves (slices) were entered. */
function manualTotals(targets: StoredManualTarget[] | null): ChangeRow {
  if (!targets?.length) return { manualSlices: null, manualTotal: null };
  const total = targets.reduce<Dec>(
    (sum, t) => sum.add(toDec(t.target) ?? new Dec(0)),
    new Dec(0),
  );
  return { manualSlices: targets.length, manualTotal: formatDec(total) };
}

const PLAN: FamilyKind = {
  entity: PlanVersion,
  family: ['planId'],
  approved: "v.approvalState = 'approved'",
  effective: 'validFrom',
  link: 'supersedesVersionId',
  beforeLabel: 'Approved version',
  project: (row: ObjectLiteral) => ({
    ...row,
    ...manualTotals(row.manualTargets as StoredManualTarget[] | null),
  }),
  specs: [
    { key: 'headerTarget', label: 'Plan target', format: 'number' },
    { key: 'manualTotal', label: 'Σ manual slice targets', format: 'number' },
    { key: 'manualSlices', label: 'Manual slices', format: 'number' },
    { key: 'validFrom', label: 'Valid from', format: 'instant' },
    { key: 'validTo', label: 'Valid until', format: 'instant' },
    { key: 'basis', label: 'Basis' },
    { key: 'targetSource', label: 'Target source' },
    { key: 'distribution', label: 'Distribution' },
    { key: 'version', label: 'Version', format: 'number' },
    { key: 'changeReason', label: 'Change reason' },
  ],
};

const BODY = 'body';
const POLICY_EXTRA: FieldSpec[] = [
  { key: 'effectiveFrom', label: 'Effective from', format: 'instant' },
  { key: 'backdateReason', label: 'Backdate reason' },
  {
    key: 'restateApproved',
    label: 'Restate approved periods',
    format: 'boolean',
  },
  { key: 'notes', label: 'Notes' },
];

/** A policy's settings as leaf paths of its body (`Default view`, `Materiality › threshold`, …). */
const policyKind = (beforeLabel: string): FamilyKind => ({
  entity: AccountingPolicy,
  family: ['policyKind', 'scopeKey'],
  approved: 'v.approvedAt IS NOT NULL',
  link: 'basedOnId',
  beforeLabel,
  project: (row: ObjectLiteral) => ({ ...row, ...flattenJson(row.body, BODY) }),
  specs: (after, before) => [
    ...jsonSpecs(bodyOf(after), before ? bodyOf(before) : null).map((spec) => ({
      ...spec,
      label: pathLabel(spec.key.slice(BODY.length + 1)),
    })),
    ...POLICY_EXTRA,
  ],
});
const bodyOf = (row: ChangeRow): ChangeRow =>
  Object.fromEntries(
    Object.entries(row).filter(([key]) => key.startsWith(`${BODY}.`)),
  );

const SOURCE_STATUS: FamilyKind = {
  entity: SourceStatusMapping,
  family: ['sourceSystem'],
  approved: "v.state = 'approved'",
  beforeLabel: 'Approved rules',
  project: (row: ObjectLiteral) => ({
    ...row,
    ...Object.fromEntries(
      (
        (row.statuses as Array<{ status: string; released: boolean }> | null) ??
        []
      ).map((s) => [
        `status:${s.status}`,
        s.released ? 'released' : 'not released',
      ]),
    ),
  }),
  specs: (after, before) => [
    ...jsonSpecs(statusesOf(after), before ? statusesOf(before) : null).map(
      (spec) => ({ ...spec, label: `Status ${spec.key.slice(7)}` }),
    ),
    ...VALIDITY,
    { key: 'notes', label: 'Notes' },
  ],
};
const statusesOf = (row: ChangeRow): ChangeRow =>
  Object.fromEntries(
    Object.entries(row).filter(([key]) => key.startsWith('status:')),
  );

const DISPOSITION: FamilyKind = {
  entity: LotDisposition,
  family: [],
  approved: "v.state = 'approved'",
  link: 'supersedesId',
  beforeLabel: 'Superseded disposition',
  specs: [
    { key: 'dispositionClass', label: 'Class' },
    { key: 'quantity', label: 'Quantity', format: 'quantity', unit: uomOf },
    { key: 'lotCode', label: 'Lot' },
    { key: 'productId', label: 'Product', ref: 'product' },
    { key: 'productionStart', label: 'Produced from', format: 'instant' },
    { key: 'productionEnd', label: 'Produced until', format: 'instant' },
    { key: 'labReleasedAt', label: 'Lab released', format: 'instant' },
    { key: 'remeasured', label: 'Remeasured', format: 'boolean' },
    { key: 'reason', label: 'Reason' },
    { key: 'evidenceRef', label: 'Evidence' },
  ],
};

const ADJUSTMENT: FamilyKind = {
  entity: ActualsAdjustment,
  family: [],
  approved: 'FALSE',
  specs: [
    { key: 'quantity', label: 'Quantity', format: 'quantity', unit: uomOf },
    { key: 'kind', label: 'Adjustment' },
    { key: 'basis', label: 'Basis' },
    { key: 'windowFrom', label: 'Window from', format: 'instant' },
    { key: 'windowTo', label: 'Window until', format: 'instant' },
    { key: 'reason', label: 'Reason' },
    { key: 'evidenceRef', label: 'Evidence' },
  ],
};

const BUDGET: FamilyKind = {
  entity: UncertaintyBudget,
  family: ['unitId', 'boundary'],
  approved: "v.state = 'approved'",
  beforeLabel: 'Approved budget',
  specs: [
    {
      key: 'expandedUncertainty',
      label: 'Expanded uncertainty',
      format: 'quantity',
      unit: uomOf,
    },
    {
      key: 'combinedStandardUncertainty',
      label: 'Combined standard uncertainty',
      format: 'quantity',
      unit: uomOf,
    },
    { key: 'coverageFactor', label: 'Coverage factor', format: 'number' },
    { key: 'boundary', label: 'Boundary' },
    { key: 'calibrationRef', label: 'Calibration' },
    { key: 'reviewDueAt', label: 'Review due', format: 'instant' },
    { key: 'evidenceRef', label: 'Evidence' },
    { key: 'notes', label: 'Notes' },
    ...VALIDITY,
  ],
};

export const WORKFLOW_CHANGE_KINDS: Readonly<Record<string, FamilyKind>> = {
  plan: PLAN,
  'valuation-policy': policyKind('Approved policy'),
  'source-authority': policyKind('Approved priority'),
  'source-status': SOURCE_STATUS,
  disposition: DISPOSITION,
  adjustment: ADJUSTMENT,
  'uncertainty-budget': BUDGET,
};

/** A rule's draft definition against the active version's definition. */
export async function loadRuleChanges(
  manager: EntityManager,
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const rules = await manager
    .createQueryBuilder(Rule, 'r')
    .where('r.tenantId = :tenantId', { tenantId })
    .andWhere('r.id IN (:...ids)', { ids })
    .getMany();
  const active = rules.filter((rule) => rule.activeVersion !== null);
  const versions = active.length
    ? await manager
        .createQueryBuilder(RuleVersion, 'v')
        .where('v.tenantId = :tenantId', { tenantId })
        .andWhere('v.ruleId IN (:...ruleIds)', {
          ruleIds: active.map((rule) => rule.id),
        })
        .andWhere('v.version IN (:...versions)', {
          versions: active.map((rule) => rule.activeVersion),
        })
        .getMany()
    : [];
  return rules.map((rule) => {
    const current = versions.find(
      (v) => v.ruleId === rule.id && v.version === rule.activeVersion,
    );
    const after = {
      name: rule.name,
      description: rule.description,
      ...flattenJson(rule.draftDefinition, 'definition'),
    };
    const before = current
      ? {
          name: rule.name,
          description: rule.description,
          ...flattenJson(current.definition, 'definition'),
        }
      : null;
    const specs = jsonSpecs(after, before).map((spec) => ({
      ...spec,
      label: spec.key.startsWith('definition.')
        ? pathLabel(spec.key.slice(11))
        : pathLabel(spec.key),
    }));
    return {
      id: rule.id,
      after,
      before,
      specs,
      beforeLabel: current ? `Active version ${current.version}` : undefined,
    };
  });
}
