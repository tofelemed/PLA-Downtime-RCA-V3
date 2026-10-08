import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Base for every new tenant-owned table (spec DB01).
 *
 * - UUID primary key and `tenant_id` so child foreign keys can include the tenant (no cross-tenant links)
 * - audit columns and `row_version` for optimistic concurrency (`If-Match` / 412 on stale updates)
 *
 * Legacy entities keep their own columns until they are migrated; new entities under src/**\/v2 must extend this.
 */
export abstract class TenantScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion: number;
}
