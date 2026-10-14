import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { ScheduleExclusionKind } from '../../domain/calendar/calendar.types';
import { Unit } from '../../unit/unit.entity';
import { CalendarVersion } from './calendar-version.entity';
import { Crew } from './crew.entity';

/**
 * A generated shift of one unit (spec §14.2 `shift_instances`, CAL01/CAL02): stored UTC bounds
 * (half-open), the offsets in force at start and just before the end (minutes east of UTC) and the
 * local labels, so a later tz-database change never reinterprets an approved period. Instances of a
 * unit never overlap (exclusion constraint); an excluded piece has its kind and reason.
 */
@Entity('shift_instances')
@Unique('UQ_shift_instances_unit_start', ['unitId', 'utcStart'])
@Exclusion(
  'EX_shift_instances_unit_no_overlap',
  `USING gist ("unit_id" WITH =, tstzrange("utc_start", "utc_end", '[)') WITH &&)`,
)
@Index('IDX_shift_instances_tenant_unit_date', [
  'tenantId',
  'unitId',
  'localDate',
])
@Index('IDX_shift_instances_calendar_version', ['calendarVersionId'])
@Index('IDX_shift_instances_crew', ['crewId'])
@Check('CHK_shift_instances_interval', '"utc_end" > "utc_start"')
@Check(
  'CHK_shift_instances_exclusion',
  '"is_excluded" = ("exclusion_kind" IS NOT NULL)',
)
export class ShiftInstance extends TenantOwnedEntity {
  @Column({ name: 'calendar_version_id', type: 'uuid' })
  calendarVersionId: string;

  @ManyToOne(() => CalendarVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'calendar_version_id' })
  calendarVersion?: CalendarVersion;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  /** operational (production) date */
  @Column({ name: 'local_date', type: 'date' })
  localDate: string;

  @Column({ name: 'shift_name', type: 'varchar', length: 64 })
  shiftName: string;

  @Column({ name: 'utc_start', type: 'timestamptz' })
  utcStart: Date;

  @Column({ name: 'utc_end', type: 'timestamptz' })
  utcEnd: Date;

  @Column({ name: 'utc_offset_start', type: 'int' })
  utcOffsetStart: number;

  @Column({ name: 'utc_offset_end', type: 'int' })
  utcOffsetEnd: number;

  @Column({ name: 'local_start', type: 'varchar', length: 32 })
  localStart: string;

  @Column({ name: 'local_end', type: 'varchar', length: 32 })
  localEnd: string;

  @Column({ name: 'is_excluded', type: 'boolean', default: false })
  isExcluded: boolean;

  @Column({
    name: 'exclusion_kind',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  exclusionKind: ScheduleExclusionKind | null;

  @Column({ name: 'exclusion_reason', type: 'text', nullable: true })
  exclusionReason: string | null;

  @Column({ name: 'crew_id', type: 'uuid', nullable: true })
  crewId: string | null;

  @ManyToOne(() => Crew, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'crew_id' })
  crew?: Crew | null;
}
