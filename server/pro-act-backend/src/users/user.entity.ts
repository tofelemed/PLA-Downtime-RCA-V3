import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Index('IDX_users_tenant_name', ['tenantId', 'name', 'id'])
@Index('IDX_users_organization', ['organizationId'])
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'role', type: 'varchar', length: 50 })
  role: string; // Enum: SuperAdmin, OrgAdmin, TenantAdmin, Analyst, Engineer, Operator

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string;

  // Note: phone and department columns don't exist in the database schema
  // If needed, add them via migration first
  // @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  // phone?: string;

  // @Column({ name: 'department', type: 'varchar', length: 100, nullable: true })
  // department?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 