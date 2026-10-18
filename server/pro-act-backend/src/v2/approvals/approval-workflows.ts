import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { SourceStatusMapping } from '../../periods/entities/source-status-mapping.entity';
import { ActualsAdjustment } from '../../periods/entities/actuals-adjustment.entity';
import { LotDisposition } from '../../quality-dispositions/entities/lot-disposition.entity';
import { UncertaintyBudget } from '../../uncertainty/entities/uncertainty-budget.entity';
import { PlanVersion } from '../../plans/entities/plan-version.entity';
import { ProductionPlan } from '../../production-plan/production-plan.entity';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { PeriodChangeProposal } from '../../reconciliation/entities/period-change-proposal.entity';
import { Rule } from '../../rules/entities/rule.entity';
import { RCA } from '../../rca/rca.entity';
import { MonthClose } from '../../close/entities/month-close.entity';
import { StopReconciliation } from '../../stop-events/entities/stop-reconciliation.entity';
import { PLAN_APPROVERS } from '../plans/plan-roles';
import {
  ADJUSTMENT_APPROVERS,
  REVISION_APPROVERS,
} from '../periods/period-roles';
import { DISPOSITION_APPROVERS } from '../quality-dispositions/disposition-roles';
import { BUDGET_APPROVERS } from '../uncertainty/uncertainty-roles';
import { SOURCE_AUTHORITY_APPROVERS } from '../source-authority/source-authority-roles';
import { FINANCE_APPROVERS } from '../valuation/valuation-roles';
import { ApprovalDefinition } from './approval-catalog';

const PERIOD_JOIN = {
  entity: ProductionPeriod,
  alias: 'p',
  on: 'p.id = r.periodId AND p.tenantId = r.tenantId',
};
const VERSION_JOIN = {
  entity: PlanVersion,
  alias: 'v',
  on: 'v.id = p.selectedPlanVersionId AND v.tenantId = r.tenantId',
};
/** The period workspace section of a record (`/plans/:planId/periods/:periodId/<section>#<anchor>`). */
const periodHref = (section: string, anchor: string) =>
  `CASE WHEN v.planId IS NOT NULL THEN '/plans/' || v.planId || '/periods/' || r.periodId || '${section}#' || ${anchor} ELSE '/my-queue' END`;
const PERIOD_TARGET = { periodId: 'r.periodId', planId: 'v.planId' };
const REVISION_TARGET = { ...PERIOD_TARGET, revision: 'r.revision' };
/** The period of a disposition's production start on its unit (dispositions are listed per period). */
const DISPOSITION_PERIOD = (column: string) =>
  `(SELECT ${column} FROM production_periods dp JOIN plan_versions dv ON dv.id = dp.selected_plan_version_id WHERE dp.tenant_id = r.tenantId AND dp.unit_id = r.unitId AND dp.utc_start <= r.productionStart AND dp.utc_end > r.productionStart ORDER BY dp.utc_start LIMIT 1)`;
const monthHref = (step: string) =>
  `'/month-close?month=' || r.monthKey || '#close-step-${step}'`;
export const WORKFLOW_APPROVALS: ApprovalDefinition[] = [
  {
    kind: 'plan',
    label: 'Production plan',
    entity: PlanVersion,
    roles: PLAN_APPROVERS,
    pending: "r.approvalState = 'submitted' AND h.currentVersion = r.version",
    unit: 'r.unitId',
    joins: [
      {
        entity: ProductionPlan,
        alias: 'h',
        on: 'h.id = r.planId AND h.tenantId = r.tenantId',
      },
    ],
    title: 'h.name',
    summary: "concat(r.basis, ' · ', r.validFrom, ' – ', r.validTo)",
    state: 'r.approvalState',
    href: "'/planning/plans/' || r.planId || '#plan-version-' || r.version",
    target: { planId: 'r.planId' },
    resource: 'production-plans',
    commandId: 'r.planId',
    actions: ['approve', 'return'],
  },
  {
    kind: 'valuation-policy',
    label: 'Valuation policy',
    entity: AccountingPolicy,
    roles: FINANCE_APPROVERS,
    pending: "r.policyKind = 'valuation_basis' AND r.approvedAt IS NULL",
    title: "'Valuation policy'",
    summary: 'r.body::text',
    state: "'draft'",
    href: "'/finance/policies/' || r.id",
    resource: 'valuation-policies',
    actions: ['approve'],
  },
  {
    kind: 'source-authority',
    label: 'Source priority',
    entity: AccountingPolicy,
    roles: SOURCE_AUTHORITY_APPROVERS,
    pending:
      "r.policyKind = 'source_authority' AND r.approvedAt IS NULL AND r.rejectedAt IS NULL",
    unit: 'r.unitId',
    title: "'Measurement source priority'",
    summary: 'r.body::text',
    state: "'proposed'",
    href: "'/connectivity/source-authority' || CASE WHEN r.unitId IS NOT NULL THEN '?unitId=' || r.unitId ELSE '' END || '#source-authority-version-' || r.id",
    resource: 'source-authority/versions',
    actions: ['approve', 'reject'],
  },
  {
    kind: 'source-status',
    label: 'Source status rules',
    entity: SourceStatusMapping,
    roles: ['production_accountant'],
    pending: "r.state = 'draft'",
    title: "r.sourceSystem || ' status rules'",
    summary: 'r.statuses::text',
    href: "'/connectivity/source-status#status-mapping-' || r.id",
  },
  {
    kind: 'adjustment',
    label: 'Actuals adjustment',
    entity: ActualsAdjustment,
    roles: ADJUSTMENT_APPROVERS,
    pending: "r.state = 'proposed'",
    version: 'NULL::int',
    author: 'r.authorId',
    unit: 'r.unitId',
    title: "r.kind || ' adjustment'",
    summary: "concat(r.quantity, ' ', r.uom, ' · ', r.reason)",
    href: periodHref('/actuals', "'adjustment-' || r.id"),
    target: PERIOD_TARGET,
    joins: [PERIOD_JOIN, VERSION_JOIN],
    resource: 'actuals/adjustments',
    actions: ['approve', 'reject'],
  },
  {
    kind: 'disposition',
    label: 'Quality disposition',
    entity: LotDisposition,
    roles: DISPOSITION_APPROVERS,
    pending: "r.state = 'proposed'",
    version: 'NULL::int',
    author: 'r.authorId',
    unit: 'r.unitId',
    title: "r.lotCode || ' · ' || r.dispositionClass",
    summary: "concat(r.quantity, ' ', r.uom, ' · ', r.reason)",
    href: `COALESCE(${DISPOSITION_PERIOD("'/plans/' || dv.plan_id || '/periods/' || dp.id || '/actuals#disposition-' || r.id")}, '/planning')`,
    target: {
      periodId: DISPOSITION_PERIOD('dp.id::text'),
      planId: DISPOSITION_PERIOD('dv.plan_id::text'),
    },
    resource: 'lot-dispositions',
    actions: ['approve', 'reject'],
  },
  {
    kind: 'uncertainty-budget',
    label: 'Uncertainty budget',
    entity: UncertaintyBudget,
    roles: BUDGET_APPROVERS,
    pending: "r.state = 'proposed'",
    version: 'NULL::int',
    author: 'r.authorId',
    unit: 'r.unitId',
    title: "r.boundary || ' budget'",
    summary: "concat(r.calibrationRef, ' · ', r.notes)",
    href: "'/measurement-uncertainty?unitId=' || r.unitId || '#uncertainty-budget-' || r.id",
    resource: 'uncertainty-budgets',
    actions: ['approve', 'reject'],
  },
  {
    kind: 'rule',
    label: 'Rule activation',
    entity: Rule,
    roles: ['manager_approver'],
    pending: 'r.draftDefinition IS NOT NULL AND r.retiredAt IS NULL',
    author: 'r.draftAuthor',
    title: 'r.name',
    summary: 'r.description',
    version: 'r.activeVersion',
    href: "'/master-data/codes-rules/rules/' || r.id",
    resource: 'rules',
    actions: ['activate', 'retire'],
  },
  {
    kind: 'period-review',
    label: 'Period reconciliation',
    entity: AccountingRevision,
    roles: REVISION_APPROVERS,
    pending: "r.lifecycle = 'in_review' AND r.submittedAt IS NOT NULL",
    unit: 'p.unitId',
    author: 'r.submittedBy',
    state: "CASE WHEN r.isStale THEN 'stale' ELSE r.lifecycle::text END",
    version: 'r.revision',
    title: "concat(p.localDate, ' · ', p.shiftName)",
    summary: "concat('Revision ', r.revision, ' · ', r.staleReason)",
    href: periodHref('/review', "'period-review'"),
    target: REVISION_TARGET,
    joins: [PERIOD_JOIN, VERSION_JOIN],
  },
  {
    kind: 'finance-posting',
    label: 'Restatement posting',
    entity: AccountingRevision,
    roles: FINANCE_APPROVERS,
    pending:
      "r.lifecycle = 'approved' AND r.supersedesId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM restatement_postings posting WHERE posting.tenant_id = r.tenantId AND posting.revision_id = r.id)",
    unit: 'p.unitId',
    author: 'r.approvedBy',
    state: "'awaiting_posting'",
    version: 'r.revision',
    title: "concat(p.localDate, ' · restatement ', r.revision)",
    summary:
      "'Set the posting date and treatment after reviewing the approved restatement delta'",
    href: periodHref('/review', "'restatement'"),
    target: REVISION_TARGET,
    ownMayDecide: true,
    joins: [PERIOD_JOIN, VERSION_JOIN],
  },
  {
    kind: 'change-proposal',
    label: 'Period change proposal',
    entity: PeriodChangeProposal,
    roles: ['production_accountant', 'manager_approver'],
    pending: "r.state = 'open'",
    unit: 'r.unitId',
    title: "'Approved-period change'",
    author: "(r.detail->'manual'->>'proposedBy')::uuid",
    summary: 'r.trigger',
    href: periodHref('/history', "'change-proposal-' || r.id"),
    target: PERIOD_TARGET,
    joins: [PERIOD_JOIN, VERSION_JOIN],
  },
  {
    kind: 'rca-closure',
    label: 'RCA closure',
    entity: RCA,
    state: 'r.status',
    roles: ['manager_approver'],
    pending: "r.status = 'closure_review'",
    unit: 'r.unitId',
    author: 'r.closureRequestedBy',
    title: 'r.title',
    summary: 'r.closureNote',
    href: "'/rca/' || r.id || '#rca-workflow'",
  },
  {
    kind: 'month-materiality',
    label: 'Month materiality review',
    entity: MonthClose,
    roles: ['production_accountant', 'manager_approver', 'finance_approver'],
    pending:
      "r.state = 'quantities_closed' AND r.materialityRequired AND r.materialityReviewedBy IS NULL",
    joins: [
      {
        entity: AccountingPolicy,
        alias: 'pol',
        on: 'pol.id = r.policyId AND pol.tenantId = r.tenantId',
      },
    ],
    author: 'r.quantitiesClosedBy',
    title: "r.monthKey || ' materiality review'",
    summary: "'Review the materiality findings before finance sign-off'",
    href: monthHref('materiality-review'),
    target: { monthKey: 'r.monthKey' },
    ownReason:
      'You closed the quantities; the materiality review needs someone else.',
  },
  {
    kind: 'month-finance',
    label: 'Month finance sign-off',
    entity: MonthClose,
    roles: FINANCE_APPROVERS,
    pending:
      "r.state = 'quantities_closed' AND (NOT r.materialityRequired OR r.materialityReviewedBy IS NOT NULL)",
    author: 'r.quantitiesClosedBy',
    title: "r.monthKey || ' finance sign-off'",
    summary: "'Review quantity close and finance prerequisites'",
    href: monthHref('finance-sign-off'),
    target: { monthKey: 'r.monthKey' },
    ownReason:
      'You closed the quantities; finance sign-off needs someone else.',
  },
  {
    kind: 'month-lock',
    label: 'Month lock',
    entity: MonthClose,
    roles: FINANCE_APPROVERS,
    pending: "r.state = 'finance_signed_off'",
    author: 'r.financeSignedOffBy',
    title: "r.monthKey || ' lock'",
    summary: "'Finance signed off; review prerequisites and lock the month'",
    href: monthHref('lock'),
    target: { monthKey: 'r.monthKey' },
    ownMayDecide: true,
  },
  {
    kind: 'stop-merge',
    label: 'Duplicate stop review',
    entity: StopReconciliation,
    roles: ['manager_approver', 'production_engineer'],
    pending: "r.state = 'suggested'",
    unit: 'r.unitId',
    title: "'Suggested duplicate stop'",
    summary: 'r.suggestionReason',
    href: "'/events/' || r.keptEventId || '?tab=related#stop-merge-' || r.id",
    target: { eventId: 'r.keptEventId' },
  },
];
