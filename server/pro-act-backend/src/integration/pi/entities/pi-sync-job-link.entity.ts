import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { IngestionJob } from '../../../intake/entities/ingestion-job.entity';
import { PISyncJob } from '../../../pi-sync-job/pi-sync-job.entity';

/**
 * Crosswalk from a v1 `pi_sync_jobs` row to the leased ingestion job that now does its work (plan 1.6
 * step 5): the v1 screens keep their job, the worker runs the ingestion job, status is mirrored back.
 */
@Entity('pi_sync_job_links')
@Index('IDX_pi_sync_job_links_ingestion_job', ['ingestionJobId'])
export class PiSyncJobLink {
  @PrimaryColumn({ name: 'pi_sync_job_id', type: 'uuid' })
  piSyncJobId: string;

  @ManyToOne(() => PISyncJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pi_sync_job_id' })
  piSyncJob?: PISyncJob;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'ingestion_job_id', type: 'uuid' })
  ingestionJobId: string;

  @ManyToOne(() => IngestionJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingestion_job_id' })
  ingestionJob?: IngestionJob;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
