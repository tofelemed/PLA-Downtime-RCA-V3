import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
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
} from 'class-validator';
import {
  FAILURE_GROUP_KINDS,
  FailureGroupKind,
} from '../../code-library/code-library-kind';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import {
  OEE_COMPONENTS,
  OeeComponent,
  SCHEDULE_CLASSES,
  ScheduleClass,
} from '../../domain/events/event-classification';
import { ListQueryDto } from '../common/list-query.dto';

const LIBRARY_NOTE =
  ' (only libraries that have the field accept it; others answer 422 FIELD_NOT_ALLOWED)';

/** Optional fields of a code; every library accepts a subset (see the endpoint description). */
export class CodeV2FieldsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Parent code of the same library and tenant; null makes a root' +
      LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'reason, impact, oee' + LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50)
  category?: string | null;

  @ApiPropertyOptional({
    enum: OEE_COMPONENTS,
    nullable: true,
    description: 'reason' + LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(OEE_COMPONENTS)
  defaultOeeComponent?: OeeComponent | null;

  @ApiPropertyOptional({
    enum: SCHEDULE_CLASSES,
    nullable: true,
    description: 'reason' + LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(SCHEDULE_CLASSES)
  defaultScheduleClass?: ScheduleClass | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'reason: default impact code' + LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  defaultImpactCodeId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1250.5',
    description: 'impact' + LIBRARY_NOTE,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDecimal({ decimal_digits: '0,4' })
  costPerHour?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'loss_category' + LIBRARY_NOTE,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  reportOrder?: number;
}

/** Body of PUT /{library}/{id}: the next version of the code (`code` itself never changes). */
export class CodeV2ChangeDto extends CodeV2FieldsDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}

export class CodeV2CreateDto extends CodeV2FieldsDto {
  @ApiProperty({ maxLength: 50, description: 'Unique per tenant and library' })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,49}$/)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    enum: FAILURE_GROUP_KINDS,
    description: 'failure (required there)' + LIBRARY_NOTE,
  })
  @IsOptional()
  @IsIn(FAILURE_GROUP_KINDS)
  groupKind?: FailureGroupKind;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Start of validity (default now)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveFrom?: string;
}

export class CodeV2RetireDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'End of validity, exclusive (default now)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string;
}

export class CodeV2ListQueryDto extends ListQueryDto {
  // Redeclared with an initializer (TS2612) so the allowlist applies on top of the base validators.
  @ApiPropertyOptional({ enum: ['code', '-code'], default: 'code' })
  @IsOptional()
  @IsIn(['code', '-code'])
  sort?: string = undefined;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Direct children of this code',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Roots only' })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  rootsOnly?: boolean;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Codes valid at this instant (retired ones included)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  asOf?: string;

  @ApiPropertyOptional({ description: 'Include retired and deactivated codes' })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeRetired?: boolean;

  @ApiPropertyOptional({
    enum: FAILURE_GROUP_KINDS,
    description: 'failure groups only',
  })
  @IsOptional()
  @IsIn(FAILURE_GROUP_KINDS)
  groupKind?: FailureGroupKind;
}
