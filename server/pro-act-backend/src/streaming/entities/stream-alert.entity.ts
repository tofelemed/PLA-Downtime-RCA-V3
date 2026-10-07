import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('stream_alerts')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['type'])
@Index(['acknowledged'])
@Index(['timestamp'])
export class StreamAlertEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: 'warning' | 'error' | 'critical' | 'info';

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 255 })
  source: string;

  @Column({ type: 'int', default: 0 })
  severity: number;

  @Column({ default: false })
  acknowledged: boolean;

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


