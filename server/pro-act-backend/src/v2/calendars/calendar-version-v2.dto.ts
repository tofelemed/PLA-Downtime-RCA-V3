import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CALENDAR_VERSION_STATES } from '../../calendar/entities/calendar-version.entity';
import {
  EXCLUSION_KINDS,
  HOLIDAY_TREATMENTS,
} from '../../domain/calendar/calendar.types';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { ListQueryDto } from '../common/list-query.dto';

export const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_MESSAGE = 'must be a local time HH:mm';
const DATE_MESSAGE = 'must be a local date YYYY-MM-DD';

export class ShiftTemplateDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  @ApiProperty({ example: '06:00', description: 'Local start HH:mm' })
  @Matches(LOCAL_TIME, { message: `startLocal ${TIME_MESSAGE}` })
  startLocal: string;

  @ApiProperty({
    example: '14:00',
    description:
      'Local end HH:mm; at or before the start = crosses midnight (equal = 24 h)',
  })
  @Matches(LOCAL_TIME, { message: `endLocal ${TIME_MESSAGE}` })
  endLocal: string;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'ISO weekdays (1 = Monday) of the operational date; every day when absent',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];
}

export class WorkingIntervalDto {
  @ApiProperty({ example: '08:00' })
  @Matches(LOCAL_TIME, { message: `startLocal ${TIME_MESSAGE}` })
  startLocal: string;

  @ApiProperty({ example: '12:00' })
  @Matches(LOCAL_TIME, { message: `endLocal ${TIME_MESSAGE}` })
  endLocal: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];
}

export class HolidayDto {
  @ApiProperty({ example: '2026-03-21', description: 'Operational date' })
  @Matches(LOCAL_DATE, { message: `date ${DATE_MESSAGE}` })
  date: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    enum: HOLIDAY_TREATMENTS,
    description:
      'excluded = out of scheduled time; reduced = only the explicit working intervals are scheduled',
  })
  @IsIn(HOLIDAY_TREATMENTS)
  treatment: (typeof HOLIDAY_TREATMENTS)[number];

  @ApiPropertyOptional({
    type: [WorkingIntervalDto],
    description:
      'Working windows on a reduced-hours operational date. Legacy omitted windows retain their schedule with a warning.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => WorkingIntervalDto)
  workingIntervals?: WorkingIntervalDto[];
}

export class ScheduleExclusionDto {
  @ApiProperty({
    example: '2026-10-07T10:00:00+03:30',
    description: 'ISO 8601 with offset (inclusive)',
  })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({
    example: '2026-10-07T11:00:00+03:30',
    description: 'ISO 8601 with offset (exclusive)',
  })
  @IsISO8601({ strict: true })
  to: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ enum: EXCLUSION_KINDS })
  @IsIn(EXCLUSION_KINDS)
  kind: (typeof EXCLUSION_KINDS)[number];
}

/** Definition shared by POST /calendar-versions, PATCH and an inline preview candidate. */
export class CalendarDefinitionDto {
  @ApiPropertyOptional({
    example: 'Asia/Tehran',
    description: 'IANA zone; default: the site timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    example: '06:00',
    description: 'Default: the site operational day start',
  })
  @IsOptional()
  @Matches(LOCAL_TIME, { message: `operationalDayStart ${TIME_MESSAGE}` })
  operationalDayStart?: string;

  @ApiProperty({ type: [ShiftTemplateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => ShiftTemplateDto)
  shiftTemplates: ShiftTemplateDto[];

  @ApiPropertyOptional({ type: [WorkingIntervalDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => WorkingIntervalDto)
  workingIntervals?: WorkingIntervalDto[];

  @ApiPropertyOptional({ type: [HolidayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => HolidayDto)
  holidays?: HolidayDto[];

  @ApiPropertyOptional({ type: [ScheduleExclusionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => ScheduleExclusionDto)
  exclusions?: ScheduleExclusionDto[];
}

/** Definition plus the effective operational dates. */
export class CalendarVersionContentDto extends CalendarDefinitionDto {
  @ApiProperty({
    example: '2026-10-10',
    description: 'First operational date (inclusive)',
  })
  @Matches(LOCAL_DATE, { message: `effectiveFrom ${DATE_MESSAGE}` })
  effectiveFrom: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Operational date the version ends (exclusive)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(LOCAL_DATE, { message: `effectiveTo ${DATE_MESSAGE}` })
  effectiveTo?: string | null;
}

/** Body of POST /calendar-versions: a draft for a site, or a unit override (unitId). */
export class CalendarVersionCreateDto extends CalendarVersionContentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default: the tenant default site (or the unit site)',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Set for a unit override',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

/** Body of PATCH /calendar-versions/{id} (drafts only): any subset of the content; scope is fixed. */
export class CalendarVersionPatchDto extends PartialType(
  CalendarVersionContentDto,
) {}

/** Body of POST /calendar-versions/{id}/publish. */
export class CalendarPublishDto {
  @ApiPropertyOptional({
    description: 'Required to re-publish a published version (audited)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description:
      'With a reason: regenerate instances from this operational date (past included)',
  })
  @IsOptional()
  @Matches(LOCAL_DATE, { message: `regenerateFrom ${DATE_MESSAGE}` })
  regenerateFrom?: string;
}

export class CalendarVersionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Overrides of this unit',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: CALENDAR_VERSION_STATES })
  @IsOptional()
  @IsIn(CALENDAR_VERSION_STATES)
  state?: (typeof CALENDAR_VERSION_STATES)[number];

  @ApiPropertyOptional({
    description:
      'true = the site calendars only, without unit overrides (default false: both)',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  siteOnly?: boolean;
}
