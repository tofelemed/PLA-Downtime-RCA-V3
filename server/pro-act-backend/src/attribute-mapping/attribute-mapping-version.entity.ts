import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import { FieldRule } from './field-rule';

/**
 * Tenant override of a template's attribute mapping (spec ING04, §14.2 `attribute_mapping_versions`).
 * Append-only: each change is the next `version` of (tenant, template); the version in force at an
 * instant is the highest one whose `effective_from` is not after it. Its rules are merged field by field
 * over the catalog defaults (`mergeRules`), never replacing the whole template map (I10).
 */
@Entity('attribute_mapping_versions')
@Unique('UQ_attribute_mapping_versions_tenant_template_version', [
  'tenantId',
  'templateName',
  'version',
])
@Index('IDX_attribute_mapping_versions_tenant_template', [
  'tenantId',
  'templateName',
])
export class AttributeMappingVersion extends TenantScopedEntity {
  /** null = every connection of the tenant */
  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 255 })
  templateName: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'field_rules', type: 'jsonb' })
  fieldRules: FieldRule[];

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
