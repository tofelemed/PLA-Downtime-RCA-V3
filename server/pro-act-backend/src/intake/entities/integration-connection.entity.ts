import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { SOURCE_TYPES, SourceType } from '../envelope/canonical-envelope';

/** What an adapter can do (ING07); declared per connection so replay/corrections are explicit. */
export interface ConnectionCapabilities {
  replay?: boolean;
  corrections?: boolean;
  deletions?: boolean;
  quality?: boolean;
  sourceTimestamps?: boolean;
  sequence?: boolean;
}

/**
 * Source-neutral connection (spec §14.2 `integration_connections`, ING07). Endpoint configuration never
 * holds secrets: `secret_ref` points at a `secrets` row (`secrets:<uuid>`). PI connections are mirrored
 * from `pi_connections` with the same id (expand step, plan 1.5 step 7).
 */
@Entity('integration_connections')
@Index('IDX_integration_connections_tenant_source', ['tenantId', 'sourceType'])
export class IntegrationConnection extends TenantScopedEntity {
  @Column({
    name: 'source_type',
    type: 'enum',
    enum: SOURCE_TYPES,
    enumName: 'integration_source_type',
  })
  sourceType: SourceType;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ name: 'endpoint_config', type: 'jsonb', default: () => "'{}'" })
  endpointConfig: Record<string, unknown>;

  @Column({ name: 'secret_ref', type: 'text', nullable: true })
  secretRef: string | null;

  @Column({ name: 'capabilities', type: 'jsonb', default: () => "'{}'" })
  capabilities: ConnectionCapabilities;

  @Column({ name: 'config_version', type: 'int', default: 1 })
  configVersion: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
