import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('stream_data_sources')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['connectorType'])
@Index(['status'])
@Index(['enabled'])
export class StreamDataSource {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  connectorType: string;

  @Column({ type: 'simple-json', nullable: true })
  config?: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'simple-json', nullable: true })
  lastData?: any;

  @Column({ type: 'timestamptz', nullable: true })
  lastUpdate?: Date | null;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'varchar', length: 50, default: 'inactive' })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
