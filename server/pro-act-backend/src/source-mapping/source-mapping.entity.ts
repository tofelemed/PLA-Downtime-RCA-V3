import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import {
  MAPPING_TARGET_TYPES,
  MappingTargetType,
  MATCH_KINDS,
  MatchKind,
} from './mapping-rule';

/**
 * Source → plant mapping rule (spec ING03, §14.2 `source_mappings`; replaces `source_hierarchy_mappings`,
 * which stays as the v1 write store and is mirrored here until 3.10). Resolution order and matching rules
 * are in `mapping-resolver.ts`. `version` counts edits of the rule; it is returned with every resolution.
 * One active rule per (tenant, source system, connection or "any", kind, normalised value).
 */
@Entity('source_mappings')
@Index(
  'UQ_source_mappings_active_connection',
  ['tenantId', 'sourceSystem', 'connectionId', 'matchKind', 'normalizedValue'],
  { unique: true, where: '"is_active" AND "connection_id" IS NOT NULL' },
)
@Index(
  'UQ_source_mappings_active_any_connection',
  ['tenantId', 'sourceSystem', 'matchKind', 'normalizedValue'],
  { unique: true, where: '"is_active" AND "connection_id" IS NULL' },
)
@Index('IDX_source_mappings_tenant_kind', ['tenantId', 'matchKind'])
@Index('IDX_source_mappings_legacy', ['legacyMappingId'])
export class SourceMapping extends TenantScopedEntity {
  /** null = every connection of the tenant */
  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null;

  /** 'PI', 'MQTT', ... or '*' for every source system */
  @Column({
    name: 'source_system',
    type: 'varchar',
    length: 50,
    default: 'PI',
  })
  sourceSystem: string;

  @Column({
    name: 'match_kind',
    type: 'enum',
    enum: MATCH_KINDS,
    enumName: 'source_mapping_match_kind',
  })
  matchKind: MatchKind;

  /** as entered (a WebId, an AF path, a glob pattern) */
  @Column({ name: 'match_value', type: 'text' })
  matchValue: string;

  /** `normalizeMatchValue(matchKind, matchValue)`: what resolution compares */
  @Column({ name: 'normalized_value', type: 'text' })
  normalizedValue: string;

  /** patterns only: higher is evaluated first; equal precedence + different targets = ambiguous */
  @Column({ name: 'precedence', type: 'int', default: 0 })
  precedence: number;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: MAPPING_TARGET_TYPES,
    enumName: 'source_mapping_target_type',
  })
  targetType: MappingTargetType;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** `source_hierarchy_mappings.id` this rule mirrors (backfill and v1 writes) */
  @Column({ name: 'legacy_mapping_id', type: 'uuid', nullable: true })
  legacyMappingId: string | null;
}
