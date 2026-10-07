import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dnp3_connections')
@Index(['tenantId', 'enabled'])
export class DNP3Connection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'int', default: 20000 })
  port: number;

  @Column({ type: 'varchar', length: 20, default: 'tcp' })
  connectionType: string;

  @Column({ type: 'int', default: 1 })
  sourceAddress: number;

  @Column({ type: 'int', default: 1 })
  destinationAddress: number;

  @Column({ type: 'int', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'read' })
  operationType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  objectGroup: string;

  @Column({ type: 'int', nullable: true })
  objectVariation: number;

  @Column({ type: 'int', nullable: true })
  startIndex: number;

  @Column({ type: 'int', nullable: true })
  stopIndex: number;

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
