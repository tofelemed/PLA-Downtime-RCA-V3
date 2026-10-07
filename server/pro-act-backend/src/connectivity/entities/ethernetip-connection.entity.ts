import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { DataBinding } from './data-binding.entity';
import { ConnectionHealth } from './connection-health.entity';

@Entity('ethernetip_connections')
export class EtherNetIPConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'int', default: 44818 })
  port: number;

  @Column({ type: 'int', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 0 })
  backplaneSlot: number;

  @Column({ type: 'boolean', default: false })
  cipSecurity: boolean;

  @Column({ type: 'int', default: 1 })
  vendorId: number;

  @Column({ type: 'int', default: 0 })
  productCode: number;

  @Column({ type: 'int', default: 100 })
  pollingIntervalMs: number;

  @Column({ type: 'text', nullable: true })
  tagPaths: string | null; // JSON array of tag paths

  @Column({ type: 'text', nullable: true })
  dataTypes: string | null; // JSON array of data types

  @Column({ type: 'text', nullable: true })
  arraySizes: string | null; // JSON array of array sizes

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId: string | null;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status: string; // 'connected', 'disconnected', 'error', 'connecting'

  @Column({ type: 'timestamptz', nullable: true })
  lastConnected: Date | null;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @OneToMany(() => DataBinding, binding => binding.sourceEtherNetIPConnection)
  sourceBindings: DataBinding[];

  @OneToMany(() => ConnectionHealth, health => health.ethernetipConnection)
  healthRecords: ConnectionHealth[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
