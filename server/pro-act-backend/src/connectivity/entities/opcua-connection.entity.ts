import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { DataBinding } from './data-binding.entity';
import { ConnectionHealth } from './connection-health.entity';

@Entity('opcua_connections')
export class OPCUAConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'endpoint', type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ name: 'security_mode', type: 'varchar', length: 50, default: 'SignAndEncrypt' })
  securityMode: string;

  @Column({ name: 'security_policy', type: 'varchar', length: 100, default: 'Basic256Sha256' })
  securityPolicy: string;

  @Column({ name: 'authentication', type: 'varchar', length: 50, default: 'Anonymous' })
  authentication: string; // 'Anonymous', 'Username', 'Certificate'

  @Column({ name: 'certificate_path', type: 'varchar', length: 500, nullable: true })
  certificatePath: string | null;

  @Column({ name: 'private_key_path', type: 'varchar', length: 500, nullable: true })
  privateKeyPath: string | null;

  @Column({ name: 'reconnect_interval_ms', type: 'int', default: 5000 })
  reconnectIntervalMs: number;

  @Column({ name: 'max_reconnect_attempts', type: 'int', default: 5 })
  maxReconnectAttempts: number;

  @Column({ name: 'username', type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'timeout_ms', type: 'int', default: 30000 })
  timeoutMs: number;

  @Column({ name: 'session_timeout_ms', type: 'int', default: 60000 })
  sessionTimeoutMs: number;

  @Column({ name: 'keep_alive_ms', type: 'int', default: 10000 })
  keepAliveMs: number;

  @Column({ name: 'max_message_size', type: 'int', default: 65536 })
  maxMessageSize: number;

  @Column({ name: 'polling_interval_ms', type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ name: 'subscription_size', type: 'int', default: 1000 })
  subscriptionSize: number;

  @Column({ name: 'default_nodes', type: 'text', nullable: true })
  defaultNodes: string | null;

  @Column({ name: 'application_name', type: 'varchar', length: 500, nullable: true })
  applicationName: string | null;

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

  @OneToMany(() => DataBinding, binding => binding.sourceOPCUAConnection)
  sourceBindings: DataBinding[];

  @OneToMany(() => ConnectionHealth, health => health.opcuaConnection)
  healthRecords: ConnectionHealth[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
