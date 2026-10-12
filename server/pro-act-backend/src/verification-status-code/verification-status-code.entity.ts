import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';

@Entity('verification_status_codes')
@Index('IDX_verification_status_codes_tenant_code', ['tenantId', 'code'])
export class VerificationStatusCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Badge colour of the checklist (hex, e.g. `#3B82F6`); rows created before the column have none. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string | null;

  /** Checklist items in display order (the settings form's ordered list of labels). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  items: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  /** Optimistic concurrency version (If-Match on v2 master-data changes) */
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 