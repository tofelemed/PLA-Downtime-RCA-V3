import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('stream_connection_configs')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['type'])
@Index(['enabled'])
@Index(['connectionStatus'])
export class StreamConnectionConfigEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'simple-json', nullable: true })
  config?: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastConnection?: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';

  @Column({ type: 'int', default: 0 })
  errorCount: number;

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


