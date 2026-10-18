import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { Product } from '../../product/product.entity';

export const DEMAND_STATUSES = [
  'demand_constrained',
  'not_constrained',
] as const;
export type DemandStatusValue = (typeof DEMAND_STATUSES)[number];

/**
 * SME V3 (14 Oct 2026): whether a product was sold out (demand constrained) over `[effective_from,
 * effective_to)` — the indicator that lost tonnes are lost sales. Finance-maintained with its evidence
 * (unmet demand, inventory cover, catch-up), approved by a finance approver who is not the author;
 * versioned like master data (approved versions of a product never overlap). The economic view reads the
 * approved status in force at a line's date; none → the line stays unvalued.
 */
@Entity('demand_statuses')
@Index('IDX_approval_inbox_demand_statuses', { synchronize: false })
@Exclusion(
  'EX_demand_statuses_approved_no_overlap',
  `USING gist ("tenant_id" WITH =, "product_id" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_demand_statuses_tenant_product_from', [
  'tenantId',
  'productId',
  'effectiveFrom',
])
@Index('IDX_demand_statuses_product', ['productId'])
@Check(
  'CHK_demand_statuses_status',
  `"status" IN ('demand_constrained', 'not_constrained')`,
)
@Check(
  'CHK_demand_statuses_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_demand_statuses_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class DemandStatus extends TenantScopedEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'FK_demand_statuses_product',
  })
  product?: Product;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status: DemandStatusValue;

  /** what substantiates the status (orders, inventory cover, catch-up ability) — required, never interpreted */
  @Column({ name: 'evidence', type: 'text' })
  evidence: string;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({
    name: 'state',
    type: 'enum',
    enum: VERSION_STATES,
    enumName: 'demand_status_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
