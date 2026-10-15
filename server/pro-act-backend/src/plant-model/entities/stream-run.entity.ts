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
import { Product } from '../../product/product.entity';
import { Unit } from '../../unit/unit.entity';

/**
 * Which product a stream of a unit ran over `[start, end)` (SME E6; end null = still running) and the
 * production lot made on that run. Runs of one stream never overlap; lot codes are unique per tenant, so
 * an output measured downstream (silo, packaging) with a lot code keeps the grade it was made as.
 */
@Entity('stream_runs')
@Exclusion(
  'EX_stream_runs_no_overlap',
  `USING gist ("unit_id" WITH =, "stream_code" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&)`,
)
@Index('IDX_stream_runs_tenant_unit_start', ['tenantId', 'unitId', 'startTime'])
@Index('IDX_stream_runs_product', ['productId'])
@Index('UQ_stream_runs_lot', ['tenantId', 'lotCode'], {
  unique: true,
  where: '"lot_code" IS NOT NULL',
})
@Check(
  'CHK_stream_runs_interval',
  '"end_time" IS NULL OR "end_time" > "start_time"',
)
@Check('CHK_stream_runs_lot', `"lot_code" IS NULL OR "lot_code" <> ''`)
export class StreamRunRecord extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_stream_runs_unit',
  })
  unit?: Unit;

  @Column({ name: 'stream_code', type: 'varchar', length: 64 })
  streamCode: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'FK_stream_runs_product',
  })
  product?: Product;

  @Column({ name: 'lot_code', type: 'varchar', length: 64, nullable: true })
  lotCode: string | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
