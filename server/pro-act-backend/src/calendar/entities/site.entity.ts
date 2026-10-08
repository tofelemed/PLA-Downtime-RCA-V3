import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * Site of a tenant (spec §3.1 hierarchy, CAL01): the default IANA timezone and operational day start
 * of its calendars. Today a tenant is one plant, so every tenant has exactly one default site (created
 * by the `Calendars` migration, or on first use for tenants created later); `timezone_fallback` marks a
 * site whose tenant had no valid IANA timezone and got `UTC`.
 */
@Entity('sites')
@Index('UQ_sites_default_per_tenant', ['tenantId'], {
  unique: true,
  where: '"is_default"',
})
@Index('UQ_sites_tenant_name', ['tenantId', 'name'], { unique: true })
export class Site extends TenantScopedEntity {
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone: string;

  @Column({ name: 'timezone_fallback', type: 'boolean', default: false })
  timezoneFallback: boolean;

  /** `HH:MM:SS` as Postgres returns `time` */
  @Column({ name: 'operational_day_start', type: 'time' })
  operationalDayStart: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
