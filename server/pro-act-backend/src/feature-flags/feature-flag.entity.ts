import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';

/**
 * Per-tenant switch of a migrated screen (plan 3.1, MIG02/MIG05): a pilot can flip a screen between its
 * v1 and v2 binding without a redeploy. Keys come from `FEATURE_FLAG_KEYS`; a missing row is the
 * registry default.
 */
@Entity('feature_flags')
@Index('UQ_feature_flags_tenant_key', ['tenantId', 'key'], { unique: true })
export class FeatureFlag extends TenantScopedEntity {
  @Column({ name: 'key', type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'enabled', type: 'boolean' })
  enabled: boolean;
}
