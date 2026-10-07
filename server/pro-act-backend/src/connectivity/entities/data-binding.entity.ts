import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { OPCUAConnection } from './opcua-connection.entity';
import { ModbusConnection } from './modbus-connection.entity';
import { EtherNetIPConnection } from './ethernetip-connection.entity';
import { MQTTConnection } from './mqtt-connection.entity';
import { SystemIntegration } from './system-integration.entity';
import { DataTransformation } from './data-transformation.entity';

@Entity('data_bindings')
export class DataBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  // Source connection references (only one should be set)
  @Column({ type: 'uuid', nullable: true })
  sourceOPCUAConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceModbusConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceEtherNetIPConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceMQTTConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceSystemIntegrationId: string | null;

  // Target connection references (only one should be set)
  @Column({ type: 'uuid', nullable: true })
  targetOPCUAConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetModbusConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetEtherNetIPConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetMQTTConnectionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetSystemIntegrationId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sourcePath: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  targetPath: string | null;

  @Column({ type: 'simple-json', nullable: true })
  transformationRules: any;

  @Column({ type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  triggerMode: string; // 'manual', 'scheduled', 'event-driven'

  @Column({ type: 'simple-json', nullable: true })
  schedule: any; // Cron expression or schedule configuration

  @Column({ type: 'simple-json', nullable: true })
  filters: any; // Data filtering rules

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  // Source connections
  @ManyToOne(() => OPCUAConnection, connection => connection.sourceBindings)
  sourceOPCUAConnection: OPCUAConnection;

  @ManyToOne(() => ModbusConnection, connection => connection.sourceBindings)
  sourceModbusConnection: ModbusConnection;

  @ManyToOne(() => EtherNetIPConnection, connection => connection.sourceBindings)
  sourceEtherNetIPConnection: EtherNetIPConnection;

  @ManyToOne(() => MQTTConnection, connection => connection.sourceBindings)
  sourceMQTTConnection: MQTTConnection;

  @ManyToOne(() => SystemIntegration, integration => integration.targetBindings)
  sourceSystemIntegration: SystemIntegration;

  // Target connections
  @ManyToOne(() => OPCUAConnection)
  targetOPCUAConnection: OPCUAConnection;

  @ManyToOne(() => ModbusConnection)
  targetModbusConnection: ModbusConnection;

  @ManyToOne(() => EtherNetIPConnection)
  targetEtherNetIPConnection: EtherNetIPConnection;

  @ManyToOne(() => MQTTConnection)
  targetMQTTConnection: MQTTConnection;

  @ManyToOne(() => SystemIntegration, integration => integration.targetBindings)
  targetSystemIntegration: SystemIntegration;

  @OneToMany(() => DataTransformation, transformation => transformation.binding)
  transformations: DataTransformation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
