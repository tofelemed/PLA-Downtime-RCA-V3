import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  Holiday,
  ScheduleExclusion,
  ShiftTemplate,
  WorkingInterval,
} from '../../domain/calendar/calendar.types';
import { Unit } from '../../unit/unit.entity';
import { Site } from './site.entity';

export const CALENDAR_VERSION_STATES = ['draft', 'published'] as const;
export type CalendarVersionState = (typeof CALENDAR_VERSION_STATES)[number];

/**
 * Versioned calendar of a site, or an effective-dated override of one unit (spec §14.2
 * `calendar_versions`, CAL01). Drafts are edited in place (If-Match); a published version is immutable —
 * a change is a new version, and the `calendar_versions_published_immutable` trigger refuses edits of
 * its definition. For a unit and operational date the published unit override with the highest version
 * whose `[effective_from, effective_to)` contains the date wins, else the site calendar likewise.
 */
@Entity('calendar_versions')
@Index('IDX_calendar_versions_tenant_site_unit', [
  'tenantId',
  'siteId',
  'unitId',
])
@Index('UQ_calendar_versions_site_version', ['siteId', 'version'], {
  unique: true,
  where: '"unit_id" IS NULL',
})
@Index('UQ_calendar_versions_unit_version', ['unitId', 'version'], {
  unique: true,
  where: '"unit_id" IS NOT NULL',
})
@Check(
  'CHK_calendar_versions_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_calendar_versions_published_at',
  `"state" = 'draft' OR "published_at" IS NOT NULL`,
)
export class CalendarVersion extends TenantScopedEntity {
  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'site_id' })
  site?: Site;

  /** null = the site calendar; set = override for this unit */
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit | null;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({
    name: 'state',
    type: 'enum',
    enum: CALENDAR_VERSION_STATES,
    enumName: 'calendar_version_state',
    default: 'draft',
  })
  state: CalendarVersionState;

  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone: string;

  @Column({ name: 'operational_day_start', type: 'time' })
  operationalDayStart: string;

  @Column({ name: 'shift_templates', type: 'jsonb' })
  shiftTemplates: ShiftTemplate[];

  @Column({ name: 'working_intervals', type: 'jsonb', default: () => "'[]'" })
  workingIntervals: WorkingInterval[];

  @Column({ name: 'holidays', type: 'jsonb', default: () => "'[]'" })
  holidays: Holiday[];

  @Column({ name: 'exclusions', type: 'jsonb', default: () => "'[]'" })
  exclusions: ScheduleExclusion[];

  /** operational dates, `to` exclusive */
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /** reason of the latest re-publication that regenerated past instances (audited) */
  @Column({ name: 'republish_reason', type: 'text', nullable: true })
  republishReason: string | null;
}
