import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * Key/value settings. Plan 3.11: a row is application-wide (no tenant, no user), owned by a tenant, or
 * private to one user of a tenant; `AppSettingsAccessPolicy` decides who may read and write it.
 */
@Entity('app_settings')
@Index('IDX_app_settings_tenant_user', ['tenantId', 'userId'])
export class AppSettings {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  /** owning tenant; null for an application-wide setting */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  /** owning user (a per-user preference inside `tenantId`); null otherwise */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;
}
