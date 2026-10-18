import { Check, Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const POLICY_KINDS = [
  'coverage_gate',
  'source_authority',
  'oee_policy',
  'reconciliation_tolerance',
  'valuation_basis',
  'rca_policy',
  /** SME R1 / R4: month close calendar, deadlines and materiality (plant-wide) */
  'month_close',
  /** SME R3 / R6: reconciliation deadlines, escalation and rejection escalation (plant-wide) */
  'reconciliation_sla',
] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];

/**
 * A versioned accounting policy (plan 0.2 design, `contracts/policies/*`): kind, scope (tenant-wide when
 * `unit_id` is null, else one unit), effective interval `[from, to)` and the kind's body validated by the
 * kind's JSON schema shape in the service. Plan 2.4 stores the kinds it consumes — `coverage_gate`
 * (ACT05) and `source_authority` (SRC01 / D05); results record the policy versions they used (FND03).
 * Plan 2.5 adds `oee_policy` (D04) and `reconciliation_tolerance` (D06) for the accounting engine; plan
 * 2.6 adds `valuation_basis` (D08: unapproved versions never value, VAL01).
 * The D04 / D05 / D06 defaults are seeded per tenant (migration, or first use for a new tenant).
 * `source_authority` versions are drafted and approved by someone else (owner, 15 Oct 2026); only approved
 * versions resolve.
 */
@Entity('accounting_policies')
@Index('IDX_approval_inbox_accounting_policies', { synchronize: false })
@Unique('UQ_accounting_policies_kind_scope_version', [
  'tenantId',
  'policyKind',
  'scopeKey',
  'version',
])
@Index('IDX_accounting_policies_lookup', [
  'tenantId',
  'policyKind',
  'unitId',
  'effectiveFrom',
])
@Index('IDX_accounting_policies_unit', ['unitId'])
@Index(
  'IDX_accounting_policies_pending',
  ['tenantId', 'policyKind', 'createdAt'],
  { where: '"approved_at" IS NULL AND "rejected_at" IS NULL' },
)
@Check(
  'CHK_accounting_policies_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_accounting_policies_decision',
  '"approved_at" IS NULL OR "rejected_at" IS NULL',
)
@Check(
  'CHK_accounting_policies_backdate',
  '("requested_effective_from" IS NULL) = ("backdate_reason" IS NULL)',
)
@Check(
  'CHK_accounting_policies_restate_approved',
  'NOT "restate_approved" OR "backdate_reason" IS NOT NULL',
)
export class AccountingPolicy extends TenantScopedEntity {
  @Column({
    name: 'policy_kind',
    type: 'enum',
    enum: POLICY_KINDS,
    enumName: 'accounting_policy_kind',
  })
  policyKind: PolicyKind;

  /** null = every unit of the tenant */
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  /** `tenant` or the unit id: one version sequence per kind and scope */
  @Column({ name: 'scope_key', type: 'varchar', length: 64 })
  scopeKey: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'body', type: 'jsonb' })
  body: Record<string, unknown>;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** maker-checker kinds (source_authority): a rejected draft never comes into force */
  @Column({ name: 'rejected_by', type: 'uuid', nullable: true })
  rejectedBy: string | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  /** the version in force a draft was prepared from; approval refuses a draft whose base was replaced */
  @Column({ name: 'based_on_id', type: 'uuid', nullable: true })
  basedOnId: string | null;

  /**
   * Commissioning backdate (owner, 18 Oct 2026): the past effective-from requested for this version and
   * why; a source authority draft takes effect at it on approval. Both null = effective at approval.
   */
  @Column({
    name: 'requested_effective_from',
    type: 'timestamptz',
    nullable: true,
  })
  requestedEffectiveFrom: Date | null;

  @Column({ name: 'backdate_reason', type: 'text', nullable: true })
  backdateReason: string | null;

  /**
   * Valuation policy backdate over approved figures (owner, 18 Oct 2026): approval opens a change proposal
   * for each approved period in range (normal revaluation path) instead of refusing the version.
   */
  @Column({ name: 'restate_approved', type: 'boolean', default: false })
  restateApproved: boolean;
}
