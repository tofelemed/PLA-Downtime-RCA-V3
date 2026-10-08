import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { IngestionJob } from '../../../intake/entities/ingestion-job.entity';

export const PAGE_OUTCOMES = ['fetched', 'failed', 'committed'] as const;
export type PageOutcome = (typeof PAGE_OUTCOMES)[number];

/**
 * Page manifest of a PI window read (PI04): one row per job, window and page with its outcome.
 * `fetched` = read from PI, records handed to intake; `committed` = every record durably accepted and
 * the cursor committed; `failed` = the read failed (the window is not checkpointed, the page is
 * retried). `attempts` counts reads of the same page.
 */
@Entity('pi_page_manifests')
@Unique('UQ_pi_page_manifests_job_window_page', [
  'jobId',
  'windowStart',
  'windowEnd',
  'pageIndex',
])
@Index('IDX_pi_page_manifests_tenant', ['tenantId'])
export class PiPageManifest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => IngestionJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: IngestionJob;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart: Date;

  @Column({ name: 'window_end', type: 'timestamptz' })
  windowEnd: Date;

  @Column({ name: 'page_index', type: 'int' })
  pageIndex: number;

  @Column({ name: 'start_index', type: 'int' })
  startIndex: number;

  @Column({ name: 'item_count', type: 'int', nullable: true })
  itemCount: number | null;

  @Column({ name: 'outcome', type: 'varchar', length: 16 })
  outcome: PageOutcome;

  @Column({ name: 'attempts', type: 'int', default: 1 })
  attempts: number;

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
