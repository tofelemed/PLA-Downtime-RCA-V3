import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('scada_connections')
@Index(['tenantId', 'enabled'])
export class SCADAConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'int', default: 502 })
  port: number;

  @Column({ type: 'varchar', length: 20, default: 'modbus' })
  protocol: string;

  @Column({ type: 'varchar', length: 20, default: 'tcp' })
  connectionType: string;

  @Column({ type: 'int', default: 1 })
  unitId: number;

  @Column({ type: 'int', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'read' })
  operationType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  registerType: string;

  @Column({ type: 'int', nullable: true })
  startAddress: number;

  @Column({ type: 'int', nullable: true })
  registerCount: number;

  @Column({ type: 'varchar', length: 20, default: 'uint16' })
  dataType: string;

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
