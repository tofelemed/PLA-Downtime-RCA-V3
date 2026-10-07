import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { DataBinding } from './data-binding.entity';
import { ConnectionHealth } from './connection-health.entity';

@Entity('mqtt_connections')
export class MQTTConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'broker_url', type: 'varchar', length: 500 })
  brokerUrl: string;

  @Column({ name: 'port', type: 'int', default: 1883 })
  port: number;

  @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: true })
  clientId: string | null;

  @Column({ name: 'username', type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'keep_alive_seconds', type: 'int', default: 60 })
  keepAliveSeconds: number;

  @Column({ name: 'reconnect_period_ms', type: 'int', default: 1000 })
  reconnectPeriodMs: number;

  @Column({ name: 'connect_timeout_ms', type: 'int', default: 30000 })
  connectTimeoutMs: number;

  @Column({ name: 'clean_session', type: 'boolean', default: true })
  cleanSession: boolean;

  @Column({ name: 'subscribe_topics', type: 'text', nullable: true })
  subscribeTopics: string | null; // Comma-separated list

  @Column({ name: 'publish_topic', type: 'varchar', length: 500, nullable: true })
  publishTopic: string | null;

  @Column({ name: 'qos_level', type: 'int', default: 1 })
  qosLevel: number;

  @Column({ name: 'use_tls', type: 'boolean', default: false })
  useTLS: boolean;

  @Column({ name: 'ca_cert', type: 'varchar', length: 500, nullable: true })
  caCert: string | null;

  @Column({ name: 'client_cert', type: 'varchar', length: 500, nullable: true })
  clientCert: string | null;

  @Column({ name: 'client_key', type: 'varchar', length: 500, nullable: true })
  clientKey: string | null;

  @Column({ name: 'last_will_topic', type: 'varchar', length: 500, nullable: true })
  lastWillTopic: string | null;

  @Column({ name: 'last_will_message', type: 'text', nullable: true })
  lastWillMessage: string | null;

  @Column({ name: 'last_will_qos', type: 'int', default: 1 })
  lastWillQos: number;

  @Column({ name: 'last_will_retain', type: 'boolean', default: false })
  lastWillRetain: boolean;

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

  @OneToMany(() => DataBinding, binding => binding.sourceMQTTConnection)
  sourceBindings: DataBinding[];

  @OneToMany(() => ConnectionHealth, health => health.mqttConnection)
  healthRecords: ConnectionHealth[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
