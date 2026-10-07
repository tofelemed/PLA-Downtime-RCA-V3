import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { OPCUAConnection } from './opcua-connection.entity';
import { ModbusConnection } from './modbus-connection.entity';
import { EtherNetIPConnection } from './ethernetip-connection.entity';
import { MQTTConnection } from './mqtt-connection.entity';
import { SystemIntegration } from './system-integration.entity';

@Entity('connection_health')
export class ConnectionHealth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  connectionType: string; // 'opcua', 'modbus', 'ethernetip', 'mqtt', 'system_integration'

  // Connection references (only one should be set)
  @Column({ type: 'uuid', nullable: true })
  opcuaConnectionId: string;

  @Column({ type: 'uuid', nullable: true })
  modbusConnectionId: string;

  @Column({ type: 'uuid', nullable: true })
  ethernetipConnectionId: string;

  @Column({ type: 'uuid', nullable: true })
  mqttConnectionId: string;

  @Column({ type: 'uuid', nullable: true })
  systemIntegrationId: string;

  @Column({ type: 'varchar', length: 20 })
  status: string; // 'connected', 'disconnected', 'error', 'unknown'

  @Column({ type: 'int', nullable: true })
  responseTimeMs: number;

  @Column({ type: 'int', nullable: true })
  dataPointCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  errorRate: number;

  @Column({ type: 'int', nullable: true })
  lastDataReceivedMs: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metrics: any; // Additional metrics specific to connection type

  @Column({ type: 'simple-json', nullable: true })
  configuration: any; // Snapshot of connection configuration

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  checkedAt: Date;

  @ManyToOne(() => OPCUAConnection, connection => connection.healthRecords)
  opcuaConnection: OPCUAConnection;

  @ManyToOne(() => ModbusConnection, connection => connection.healthRecords)
  modbusConnection: ModbusConnection;

  @ManyToOne(() => EtherNetIPConnection, connection => connection.healthRecords)
  ethernetipConnection: EtherNetIPConnection;

  @ManyToOne(() => MQTTConnection, connection => connection.healthRecords)
  mqttConnection: MQTTConnection;

  @ManyToOne(() => SystemIntegration, integration => integration.healthRecords)
  systemIntegration: SystemIntegration;

  @CreateDateColumn()
  createdAt: Date;
}
