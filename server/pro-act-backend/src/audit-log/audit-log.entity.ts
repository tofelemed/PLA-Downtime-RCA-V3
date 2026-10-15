import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

@Index('IDX_audit_logs_tenant_created', ['tenantId', 'createdAt'])
@Index('IDX_audit_logs_tenant_time', ['tenantId', 'timestamp', 'id'])
@Index('IDX_audit_logs_tenant_user', ['tenantId', 'userId'])
@Index('IDX_audit_logs_timestamp', ['timestamp'])
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Note: Database schema doesn't have 'userName'
  // @Column({ type: 'varchar', length: 255 })
  // userName: string;

  @Column({ name: 'action', type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId: string;

  @Column({ name: 'details', type: 'text', nullable: true })
  details?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  // Note: Database schema doesn't have 'ipAddress' or 'userAgent' columns
  // @Column({ type: 'varchar', length: 64, nullable: true })
  // ipAddress?: string;

  // @Column({ type: 'varchar', length: 255, nullable: true })
  // userAgent?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;
} 