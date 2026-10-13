import {
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CalendarSystem,
  DEFAULT_CALENDAR_SYSTEM,
  DEFAULT_DIGIT_SYSTEM,
  DigitSystem,
} from './tenant-display-settings';
import { WeekStart } from '../domain/calendar/week-start';

@Entity('tenants')
@Check(
  'CHK_tenants_calendar_system',
  `"calendar_system" IN ('gregorian', 'persian')`,
)
@Check('CHK_tenants_digits', `"digits" IN ('latin', 'persian')`)
@Check('CHK_tenants_week_start', `"week_start" IN ('monday', 'saturday')`)
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: false })
  isActive: boolean;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ name: 'contact_person', type: 'varchar', length: 255, nullable: true })
  contactPerson?: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ name: 'timezone', type: 'varchar', length: 100, nullable: true })
  timezone?: string;

  /** Calendar dates are displayed in (display only; storage and exports stay ISO Gregorian). */
  @Column({
    name: 'calendar_system',
    type: 'varchar',
    length: 16,
    default: DEFAULT_CALENDAR_SYSTEM,
  })
  calendarSystem: CalendarSystem;

  /** Digit shapes numbers and dates are displayed with. */
  @Column({
    name: 'digits',
    type: 'varchar',
    length: 8,
    default: DEFAULT_DIGIT_SYSTEM,
  })
  digits: DigitSystem;

  /** First day of the reporting week: 'monday' (ISO) or 'saturday' (Iranian plants), DT-10. */
  @Column({
    name: 'week_start',
    type: 'varchar',
    length: 16,
    default: 'monday',
  })
  weekStart: WeekStart;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 