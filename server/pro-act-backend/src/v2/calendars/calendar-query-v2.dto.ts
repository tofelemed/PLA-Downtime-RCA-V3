import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { ListQueryDto } from '../common/list-query.dto';
import { CalendarDefinitionDto, LOCAL_DATE } from './calendar-version-v2.dto';

/** Body of POST /calendars/preview: one unit, operational dates, and exactly one candidate. */
export class CalendarPreviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    example: '2026-10-24',
    description: 'First operational date (inclusive)',
  })
  @Matches(LOCAL_DATE, { message: 'localFrom must be a local date YYYY-MM-DD' })
  localFrom: string;

  @ApiProperty({
    example: '2026-10-26',
    description: 'Last operational date (inclusive); at most 62 days',
  })
  @Matches(LOCAL_DATE, { message: 'localTo must be a local date YYYY-MM-DD' })
  localTo: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A stored version of the unit or its site',
  })
  @IsOptional()
  @IsUUID()
  candidateVersionId?: string;

  @ApiPropertyOptional({
    type: CalendarDefinitionDto,
    description: 'An inline candidate definition',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CalendarDefinitionDto)
  candidateVersion?: CalendarDefinitionDto;
}

export class ShiftInstanceListQueryDto extends ListQueryDto {
  // Redeclared with an initializer (TS2612) so the allowlist applies on top of the base validators.
  @ApiPropertyOptional({ enum: ['utcStart', '-utcStart'], default: 'utcStart' })
  @IsOptional()
  @IsIn(['utcStart', '-utcStart'])
  sort?: string = undefined;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Only excluded (true) or only scheduled (false) instances',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  isExcluded?: boolean;
}

export class SiteListQueryDto extends ListQueryDto {}
