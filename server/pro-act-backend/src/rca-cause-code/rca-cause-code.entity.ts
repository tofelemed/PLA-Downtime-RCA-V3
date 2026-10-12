import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
  VersionColumn,
} from 'typeorm';

@Entity('rca_cause_codes')
@Index('IDX_rca_cause_codes_tenant_code', ['tenantId', 'code'])
export class RCACauseCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  /** Parent cause in the cause library tree (same tenant, acyclic); null for a root cause. */
  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  /** Deleting a cause deletes its subtree (the tree editor confirms "and all its children"). */
  @ManyToOne(() => RCACauseCode, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: RCACauseCode | null;

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