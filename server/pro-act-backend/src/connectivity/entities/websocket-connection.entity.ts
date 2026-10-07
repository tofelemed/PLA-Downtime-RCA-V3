import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('websocket_connections')
@Index(['tenantId', 'enabled'])
export class WebSocketConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 20, default: 'ws' })
  protocol: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subprotocol: string;

  @Column({ type: 'int', default: 30000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 5000 })
  reconnectIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'connect' })
  operationType: string;

  @Column({ type: 'text', nullable: true })
  messageHandlers: string;

  @Column({ type: 'text', nullable: true })
  eventHandlers: string;

  @Column({ type: 'boolean', default: true })
  autoReconnect: boolean;

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
