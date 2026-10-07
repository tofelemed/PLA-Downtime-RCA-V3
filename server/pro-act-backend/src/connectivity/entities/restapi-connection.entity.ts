import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('restapi_connections')
@Index(['tenantId', 'enabled'])
export class RestApiConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  baseUrl: string;

  @Column({ type: 'varchar', length: 20, default: 'https' })
  protocol: string;

  @Column({ type: 'varchar', length: 50, default: 'GET' })
  defaultMethod: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  authType: string;

  @Column({ type: 'int', default: 30000 })
  timeoutMs: number;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'int', default: 1000 })
  pollingIntervalMs: number;

  @Column({ type: 'varchar', length: 50, default: 'request' })
  operationType: string;

  @Column({ type: 'text', nullable: true })
  headers: string;

  @Column({ type: 'text', nullable: true })
  queryParams: string;

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
