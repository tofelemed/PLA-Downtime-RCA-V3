import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import { FAILURE_GROUP_KINDS, FailureGroupKind } from './code-library-kind';

/**
 * Failure code hierarchy (spec §3.2, §14.2 `failure_code_groups`): class → problem → cause → remedy,
 * separate from reason codes. Same lifecycle as every code library: current `version` (history in
 * `code_versions`), half-open active interval, materialised `path` of ids.
 */
@Entity('failure_code_groups')
@Unique('UQ_failure_code_groups_tenant_kind_code', [
  'tenantId',
  'groupKind',
  'code',
])
@Index('IDX_failure_code_groups_tenant_parent', ['tenantId', 'parentId'])
@Index('IDX_failure_code_groups_tenant_path', ['tenantId', 'path'])
export class FailureCodeGroup extends TenantScopedEntity {
  @Column({
    name: 'group_kind',
    type: 'enum',
    enum: FAILURE_GROUP_KINDS,
    enumName: 'failure_code_group_kind',
  })
  groupKind: FailureGroupKind;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => FailureCodeGroup, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent?: FailureCodeGroup;

  @Column({ name: 'path', type: 'text', nullable: true })
  path: string | null;

  @Column({ name: 'level', type: 'int', default: 0 })
  level: number;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
