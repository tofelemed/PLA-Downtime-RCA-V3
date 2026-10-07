import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

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