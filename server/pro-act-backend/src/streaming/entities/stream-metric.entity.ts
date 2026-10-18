import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('stream_metrics')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['timestamp'])
export class StreamMetricEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'int', default: 0 })
  totalEvents: number;

  @Column({ type: 'int', default: 0 })
  processedEvents: number;

  @Column({ type: 'int', default: 0 })
  droppedEvents: number;

  @Column({ type: 'float', default: 0 })
  averageLatency: number;

  @Column({ type: 'float', default: 0 })
  throughput: number;

  @Column({ type: 'int', default: 0 })
  activeSources: number;

  @Column({ type: 'int', default: 0 })
  activeSinks: number;

  @Column({ type: 'int', default: 0 })
  activeProcessors: number;

  @Column({ type: 'float', default: 0 })
  errorRate: number;

  @Column({ type: 'simple-json', nullable: true })
  dataQuality?: Record<string, any>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
