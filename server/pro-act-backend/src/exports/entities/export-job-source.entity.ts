import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { ApprovalSnapshot } from '../../reconciliation/entities/approval-snapshot.entity';
import { ExportJob } from './export-job.entity';

/** Product of a slice as labelled when the export was requested. */
export interface SliceProductLabel {
  productId: string | null;
  productName: string | null;
}

/**
 * One approved revision an export renders (plan 2.9): pinned with its approval snapshot when the export is
 * requested, in render order (`position`: unit, period start, period). The unit and product labels are
 * pinned too, so re-rendering the job reproduces the same bytes. Written once, never updated.
 */
@Entity('export_job_sources')
@Index('UQ_export_job_sources_job_position', ['exportJobId', 'position'], {
  unique: true,
})
@Index('IDX_export_job_sources_revision', ['revisionId'])
@Index('IDX_export_job_sources_snapshot', ['snapshotId'])
export class ExportJobSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'export_job_id', type: 'uuid' })
  exportJobId: string;

  @ManyToOne(() => ExportJob, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'export_job_id',
    foreignKeyConstraintName: 'FK_export_job_sources_job',
  })
  exportJob?: ExportJob;

  @Column({ name: 'position', type: 'int' })
  position: number;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'unit_name', type: 'varchar', length: 255, nullable: true })
  unitName: string | null;

  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_export_job_sources_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId: string;

  @ManyToOne(() => ApprovalSnapshot, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'snapshot_id',
    foreignKeyConstraintName: 'FK_export_job_sources_snapshot',
  })
  snapshot?: ApprovalSnapshot;

  /** slice id → product as labelled at request time */
  @Column({ name: 'slice_products', type: 'jsonb', default: () => "'{}'" })
  sliceProducts: Record<string, SliceProductLabel>;
}
