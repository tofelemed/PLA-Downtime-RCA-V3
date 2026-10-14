import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Columns of every new tenant-owned table (spec DB01) without the single-column `tenant_id` index. For
 * rewrite-heavy tables whose composite indexes all lead with `tenant_id` (DB-09): they serve every
 * `tenant_id` predicate, so the extra index only costs writes. Everything else extends `TenantScopedEntity`.
 */
export abstract class TenantOwnedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

/**
 * Base for every new tenant-owned table (spec DB01).
 *
 * - UUID primary key and `tenant_id` so child foreign keys can include the tenant (no cross-tenant links)
 * - audit columns and `row_version` for optimistic concurrency (`If-Match` / 412 on stale updates)
 * - a `tenant_id` index (same name as the former column-level `@Index()`)
 *
 * Legacy entities keep their own columns until they are migrated; new entities under src/**\/v2 must extend this.
 */
@Index(['tenantId'])
export abstract class TenantScopedEntity extends TenantOwnedEntity {}
