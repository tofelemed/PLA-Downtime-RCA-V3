import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CALENDAR_SYSTEMS,
  type CalendarSystem,
  DIGIT_SYSTEMS,
  type DigitSystem,
} from '../../../tenant/tenant-display-settings';
import { WEEK_STARTS, WeekStart } from '../../../domain/calendar/week-start';
import { ListQueryDto } from '../../common/list-query.dto';

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export class HierarchyListQueryDto extends ListQueryDto {}

export class PlantsListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Plants of this organization only' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class CreateOrganizationV2Dto {
  @ApiProperty({
    maxLength: 50,
    description: 'Short unique code (letters, digits, - _ .)',
  })
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreatePlantV2Dto extends CreateOrganizationV2Dto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    maxLength: 64,
    description: 'IANA timezone of the plant, e.g. Asia/Tehran',
  })
  @IsString()
  @MaxLength(64)
  timezone: string;

  @ApiPropertyOptional({ enum: CALENDAR_SYSTEMS, default: 'gregorian' })
  @IsOptional()
  @IsIn(CALENDAR_SYSTEMS)
  calendarSystem?: CalendarSystem;

  @ApiPropertyOptional({ enum: DIGIT_SYSTEMS, default: 'latin' })
  @IsOptional()
  @IsIn(DIGIT_SYSTEMS)
  digits?: DigitSystem;

  @ApiPropertyOptional({
    enum: WEEK_STARTS,
    description:
      'First day of the reporting week; when omitted on create: saturday for Asia/Tehran or the Persian calendar, else monday (ISO)',
  })
  @IsOptional()
  @IsIn(WEEK_STARTS)
  weekStart?: WeekStart;
}

/** `PATCH /v2/tenants/{id}/display-settings`: how dates and digits show in the plant, and its week start. */
export class PlantDisplaySettingsV2Dto {
  @ApiPropertyOptional({ enum: CALENDAR_SYSTEMS })
  @IsOptional()
  @IsIn(CALENDAR_SYSTEMS)
  calendarSystem?: CalendarSystem;

  @ApiPropertyOptional({ enum: DIGIT_SYSTEMS })
  @IsOptional()
  @IsIn(DIGIT_SYSTEMS)
  digits?: DigitSystem;

  @ApiPropertyOptional({
    enum: WEEK_STARTS,
    description:
      'First day of the reporting week: monday (ISO 8601) or saturday (Iranian week, weekend Thursday–Friday)',
  })
  @IsOptional()
  @IsIn(WEEK_STARTS)
  weekStart?: WeekStart;
}
