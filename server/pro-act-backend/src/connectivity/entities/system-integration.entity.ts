import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { DataBinding } from './data-binding.entity';
import { ConnectionHealth } from './connection-health.entity';

@Entity('system_integrations')
export class SystemIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  integrationType: string; // 'PI', 'CMMS', 'Historian', etc.

  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  systemType: string | null; // 'SAP', 'Maximo', 'Infor', etc.

  @Column({ type: 'varchar', length: 500, nullable: true })
  database: string | null;

  @Column({ type: 'int', default: 300 })
  syncIntervalSeconds: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'simple-json', nullable: true })
  configuration: any; // Additional configuration specific to integration type

  @Column({ type: 'simple-json', nullable: true })
  authentication: any; // Authentication configuration

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @OneToMany(() => DataBinding, binding => binding.targetSystemIntegration)
  targetBindings: DataBinding[];

  @OneToMany(() => ConnectionHealth, health => health.systemIntegration)
  healthRecords: ConnectionHealth[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
