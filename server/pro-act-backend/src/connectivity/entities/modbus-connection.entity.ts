import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { DataBinding } from './data-binding.entity';
import { ConnectionHealth } from './connection-health.entity';

@Entity('modbus_connections')
export class ModbusConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'connection_type', type: 'varchar', length: 20 })
  connectionType: string; // 'tcp', 'rtu', 'ascii'

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'port', type: 'int', nullable: true })
  port: number | null;

  @Column({ name: 'serial_port', type: 'varchar', length: 50, nullable: true })
  serialPort: string | null;

  @Column({ name: 'baud_rate', type: 'int', nullable: true })
  baudRate: number | null;

  @Column({ name: 'timeout_ms', type: 'int', default: 5000 })
  timeoutMs: number;

  @Column({ name: 'retry_count', type: 'int', default: 3 })
  retryCount: number;

  @Column({ name: 'unit_id', type: 'int', default: 1 })
  unitId: number;

  @Column({ name: 'polling_interval_ms', type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ name: 'start_address', type: 'int', default: 0 })
  startAddress: number;

  @Column({ name: 'register_count', type: 'int', default: 10 })
  registerCount: number;

  @Column({ name: 'data_type', type: 'varchar', length: 20, default: 'uint16' })
  dataType: string;

  @Column({ name: 'byte_ordering', type: 'varchar', length: 20, default: 'big-endian' })
  byteOrdering: string;

  @Column({ name: 'scaling_factor', type: 'decimal', precision: 10, scale: 4, default: 1 })
  scalingFactor: number;

  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'disconnected' })
  status: string; // 'connected', 'disconnected', 'error', 'connecting'

  @Column({ name: 'last_connected', type: 'timestamptz', nullable: true })
  lastConnected: Date | null;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'metadata', type: 'simple-json', nullable: true })
  metadata: any;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @OneToMany(() => DataBinding, binding => binding.sourceModbusConnection)
  sourceBindings: DataBinding[];

  @OneToMany(() => ConnectionHealth, health => health.modbusConnection)
  healthRecords: ConnectionHealth[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
