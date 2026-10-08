import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';

/**
 * Loss category definitions (spec §14.2 `loss_category_defs`): the per-tenant, hierarchical, versioned
 * list that replaces the hard-coded category list of the event UI. `name` is the display label.
 */
@Entity('loss_category_defs')
@Unique('UQ_loss_category_defs_tenant_code', ['tenantId', 'code'])
@Index('IDX_loss_category_defs_tenant_parent', ['tenantId', 'parentId'])
@Index('IDX_loss_category_defs_tenant_path', ['tenantId', 'path'])
export class LossCategoryDef extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => LossCategoryDef, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent?: LossCategoryDef;

  @Column({ name: 'path', type: 'text', nullable: true })
  path: string | null;

  @Column({ name: 'level', type: 'int', default: 0 })
  level: number;

  @Column({ name: 'report_order', type: 'int', default: 0 })
  reportOrder: number;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
