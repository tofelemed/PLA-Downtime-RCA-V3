import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  DISPOSITION_CLASSES,
  DispositionClass,
} from '../../domain/actuals/period/quality-classes';
import { Product } from '../../product/product.entity';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const LOT_DISPOSITION_STATES = [
  'proposed',
  'approved',
  'rejected',
  'superseded',
] as const;
export type LotDispositionState = (typeof LOT_DISPOSITION_STATES)[number];

const list = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');

/**
 * An approved quality disposition of (part of) a production lot (SME E3): what the lab / quality decided
 * about a quantity of one product made on one unit over the lot's production interval — the interval
 * the actuals engine aligns it to, never the lab release time (kept for traceability). A `recovered`
 * row is a recovery movement: reprocessed material of an earlier disposition (`recovery_of_id`) coming
 * back as saleable output; `remeasured` says it passed the unit's production boundary again (so it is
 * no new output). Maker-checker (CHECK); a correction is a new row that supersedes the approved one,
 * which keeps its row (`superseded`), so earlier actuals runs stay reproducible.
 */
@Entity('lot_dispositions')
@Index('IDX_lot_dispositions_tenant_unit_production', [
  'tenantId',
  'unitId',
  'productionStart',
])
@Index('IDX_lot_dispositions_tenant_lot', ['tenantId', 'lotCode'])
@Index('IDX_lot_dispositions_unit', ['unitId'])
@Index('IDX_lot_dispositions_product', ['productId'])
@Index('IDX_lot_dispositions_recovery_of', ['recoveryOfId'], {
  where: '"recovery_of_id" IS NOT NULL',
})
@Index('IDX_lot_dispositions_supersedes', ['supersedesId'], {
  where: '"supersedes_id" IS NOT NULL',
})
@Index('IDX_lot_dispositions_event', ['productionEventId'], {
  where: '"production_event_id" IS NOT NULL',
})
@Check(
  'CHK_lot_dispositions_class',
  `"disposition_class" IN (${list(DISPOSITION_CLASSES)})`,
)
@Check(
  'CHK_lot_dispositions_state',
  `"state" IN (${list(LOT_DISPOSITION_STATES)})`,
)
@Check('CHK_lot_dispositions_quantity', '"quantity" > 0')
@Check('CHK_lot_dispositions_interval', '"production_end" > "production_start"')
@Check(
  'CHK_lot_dispositions_recovery',
  `("disposition_class" = 'recovered') = ("recovery_of_id" IS NOT NULL) AND ("remeasured" = false OR "disposition_class" = 'recovered')`,
)
@Check(
  'CHK_lot_dispositions_independent',
  '"decided_by" IS NULL OR "decided_by" <> "author_id"',
)
export class LotDisposition extends TenantOwnedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_lot_dispositions_unit',
  })
  unit?: Unit;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'FK_lot_dispositions_product',
  })
  product?: Product;

  @Column({ name: 'lot_code', type: 'varchar', length: 64 })
  lotCode: string;

  @Column({ name: 'disposition_class', type: 'varchar', length: 32 })
  dispositionClass: DispositionClass;

  @Column({
    name: 'quantity',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  quantity: string;

  @Column({ name: 'uom', type: 'varchar', length: 50 })
  uom: string;

  @Column({ name: 'production_start', type: 'timestamptz' })
  productionStart: Date;

  @Column({ name: 'production_end', type: 'timestamptz' })
  productionEnd: Date;

  @Column({ name: 'lab_released_at', type: 'timestamptz', nullable: true })
  labReleasedAt: Date | null;

  @Column({ name: 'recovery_of_id', type: 'uuid', nullable: true })
  recoveryOfId: string | null;

  @ManyToOne(() => LotDisposition, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'recovery_of_id',
    foreignKeyConstraintName: 'FK_lot_dispositions_recovery_of',
  })
  recoveryOf?: LotDisposition;

  @Column({ name: 'remeasured', type: 'boolean', default: false })
  remeasured: boolean;

  @Column({ name: 'production_event_id', type: 'uuid', nullable: true })
  productionEventId: string | null;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'production_event_id',
    foreignKeyConstraintName: 'FK_lot_dispositions_event',
  })
  productionEvent?: ProductionEvent;

  @Column({ name: 'supersedes_id', type: 'uuid', nullable: true })
  supersedesId: string | null;

  @ManyToOne(() => LotDisposition, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'supersedes_id',
    foreignKeyConstraintName: 'FK_lot_dispositions_supersedes',
  })
  supersedes?: LotDisposition;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'evidence_ref', type: 'text', nullable: true })
  evidenceRef: string | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'state', type: 'varchar', length: 16, default: 'proposed' })
  state: LotDispositionState;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt: Date | null;
}
