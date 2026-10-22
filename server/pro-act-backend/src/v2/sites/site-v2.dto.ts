import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidTimeZone } from '../../domain/calendar/zone-timeline';
import { ListQueryDto } from '../common/list-query.dto';
import { trimmed } from '../units/unit-v2.dto';

export const SITE_SORTS = ['name', 'createdAt'] as const;
const SORT_VALUES = SITE_SORTS.flatMap((field) => [field, `-${field}`]);

/** `HH:MM`, 00:00 – 23:59 */
export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: 'ianaTimeZone' })
class IanaTimeZone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTimeZone(value);
  }

  defaultMessage(): string {
    return 'timezone must be an IANA time zone such as Asia/Tehran';
  }
}

/** `GET /api/v2/sites`: keyset paging, a name search and a name or creation-time sort. */
export class SitesListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: SORT_VALUES, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORT_VALUES)
  sort?: string = undefined;

  @ApiPropertyOptional({
    description: 'Case-insensitive search in the site name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** `POST /api/v2/sites`: a new site of the acting plant. */
export class SiteV2CreateDto {
  @ApiProperty({ minLength: 1, maxLength: 255, example: 'North yard' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    maxLength: 64,
    example: 'Asia/Tehran',
    description: 'IANA time zone; default = the plant time zone',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(64)
  @Validate(IanaTimeZone)
  timezone?: string;

  @ApiPropertyOptional({
    example: '06:00',
    description:
      'Start of the operational day, HH:MM; default = the default site’s',
  })
  @IsOptional()
  @IsString()
  @Matches(HH_MM, {
    message: 'operationalDayStart must be HH:MM (00:00–23:59)',
  })
  operationalDayStart?: string;
}

/** `PATCH /api/v2/sites/{id}`: rename only. */
export class SiteV2ChangeDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
