import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('bacnet_connections')
@Index(['tenantId', 'enabled'])
export class BACnetConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'int', default: 47808 })
  port: number;

  @Column({ type: 'int', default: 123 })
  deviceId: number;

  @Column({ type: 'int', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'readProperty' })
  operationType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  objectType: string;

  @Column({ type: 'int', nullable: true })
  objectInstance: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  propertyId: string;

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
