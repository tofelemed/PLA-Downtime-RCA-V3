import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { UncertaintyComponentKind } from '../../domain/uncertainty/uncertainty-budget';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const UNCERTAINTY_BUDGET_STATES = [
  'proposed',
  'approved',
  'rejected',
] as const;
export type UncertaintyBudgetState = (typeof UNCERTAINTY_BUDGET_STATES)[number];

/** A stored component: decimals as strings (the server recomputes from them, never from the totals). */
export interface StoredUncertaintyComponent {
  kind: UncertaintyComponentKind;
  label: string;
  standardUncertainty: string;
  sensitivity: string;
}

export interface StoredUncertaintyCorrelation {
  a: number;
  b: number;
  coefficient: string;
}

const list = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');

const decimal = (name: string, precision = 24, scale = 8) => ({
  name,
  type: 'numeric' as const,
  precision,
  scale,
  transformer: decimalStringTransformer,
});

/**
 * SME E4 uncertainty budget of one measurement boundary of a unit: the standard uncertainties of the
 * meters, scales, inventory, conversion and timing that a reconciliation residual there depends on,
 * optional correlations, and the coverage factor; the combined standard and expanded uncertainty are
 * computed by the server on proposal (NIST TN 1297) and stored with the evidence (calibration reference,
 * next review). Maker-checker (CHECK); effective-dated: approving a later budget of the same unit and
 * boundary ends the one in force, which keeps its row. A budget justifies a tolerance; it never sets one.
 */
@Entity('uncertainty_budgets')
@Index('IDX_approval_inbox_uncertainty_budgets', { synchronize: false })
@Index('IDX_uncertainty_budgets_tenant_unit_boundary', [
  'tenantId',
  'unitId',
  'boundary',
  'effectiveFrom',
])
@Index('IDX_uncertainty_budgets_unit', ['unitId'])
@Index('UQ_uncertainty_budgets_open', ['tenantId', 'unitId', 'boundary'], {
  unique: true,
  where: `"state" = 'approved' AND "effective_to" IS NULL`,
})
@Check(
  'CHK_uncertainty_budgets_state',
  `"state" IN (${list(UNCERTAINTY_BUDGET_STATES)})`,
)
@Check(
  'CHK_uncertainty_budgets_values',
  '"coverage_factor" > 0 AND "combined_standard_uncertainty" >= 0 AND "expanded_uncertainty" >= 0',
)
@Check(
  'CHK_uncertainty_budgets_interval',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_uncertainty_budgets_independent',
  '"decided_by" IS NULL OR "decided_by" <> "author_id" OR "super_admin_override"',
)
export class UncertaintyBudget extends TenantOwnedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_uncertainty_budgets_unit',
  })
  unit?: Unit;

  @Column({ name: 'boundary', type: 'varchar', length: 64 })
  boundary: string;

  @Column({ name: 'uom', type: 'varchar', length: 50 })
  uom: string;

  @Column({ name: 'components', type: 'jsonb' })
  components: StoredUncertaintyComponent[];

  @Column({ name: 'correlations', type: 'jsonb', default: () => "'[]'" })
  correlations: StoredUncertaintyCorrelation[];

  @Column(decimal('coverage_factor', 6, 3))
  coverageFactor: string;

  @Column(decimal('combined_standard_uncertainty'))
  combinedStandardUncertainty: string;

  @Column(decimal('expanded_uncertainty'))
  expandedUncertainty: string;

  @Column({ name: 'calibration_ref', type: 'text' })
  calibrationRef: string;

  @Column({ name: 'review_due_at', type: 'timestamptz' })
  reviewDueAt: Date;

  @Column({ name: 'evidence_ref', type: 'text', nullable: true })
  evidenceRef: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'state', type: 'varchar', length: 16, default: 'proposed' })
  state: UncertaintyBudgetState;

  /** Set only from authenticated SuperAdmin context when deciding one's own proposal. */
  @Column({ name: 'super_admin_override', type: 'boolean', default: false })
  superAdminOverride: boolean;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;
}
