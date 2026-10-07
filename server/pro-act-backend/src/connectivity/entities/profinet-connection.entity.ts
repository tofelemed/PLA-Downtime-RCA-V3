import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('profinet_connections')
@Index(['tenantId', 'enabled'])
export class ProfinetConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'int', default: 34964 })
  port: number;

  @Column({ type: 'varchar', length: 20, default: 'tcp' })
  connectionType: string;

  @Column({ type: 'int', default: 1 })
  deviceId: number;

  @Column({ type: 'int', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 100 })
  pollingIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'read' })
  operationType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  slotNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subslotNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  index: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subindex: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastConnected: Date | null;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'text', nullable: true })
  lastError: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
