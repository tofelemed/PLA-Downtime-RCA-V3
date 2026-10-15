import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ACTUALS_SOURCES,
  ActualsSource,
  FallbackCondition,
  SOURCE_CLASSES,
  SourceClass,
} from '../../domain/actuals/period/period-actuals.types';
import { ListQueryDto } from '../common/list-query.dto';
import {
  SOURCE_AUTHORITY_VERSION_STATES,
  SourceAuthorityVersionState,
} from './source-authority-v2.view';

const BOUNDARY = /^[A-Za-z0-9_.-]{1,64}$/;
const CONDITIONS: readonly FallbackCondition[] = [
  'primary_stale',
  'primary_bad_quality',
  'primary_missing',
  'primary_conflict',
];

export class BoundaryAdjustmentDto {
  @ApiProperty({
    description:
      'The record already includes the stock change between the boundaries (e.g. silo level-to-mass); false = known but never a substitute',
  })
  @IsBoolean()
  inventoryChangeAccounted: boolean;

  @ApiProperty({
    minimum: 0,
    description:
      'Time lag of this boundary behind the slice boundary, seconds (signal sources only)',
  })
  @IsInt()
  @Min(0)
  lagSeconds: number;

  @ApiProperty({
    maxLength: 500,
    example: 'silo S-1 stock reconciliation PA-2027-03',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  evidenceRef: string;
}

export class HierarchyEntryDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  rank: number;

  @ApiProperty({ enum: SOURCE_CLASSES })
  @IsIn(SOURCE_CLASSES)
  sourceClass: SourceClass;

  @ApiProperty({ enum: ACTUALS_SOURCES })
  @IsIn(ACTUALS_SOURCES)
  source: ActualsSource;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    description:
      'Source key (tag / topic) of the one signal this rank reads, e.g. a redundant meter',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  signalSourceKey?: string | null;

  @ApiProperty({ example: 'reactor_outlet' })
  @Matches(BOUNDARY, { message: 'boundary is 1-64 letters, digits, _ . -' })
  boundary: string;

  @ApiPropertyOptional({ type: BoundaryAdjustmentDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => BoundaryAdjustmentDto)
  boundaryAdjustment?: BoundaryAdjustmentDto | null;
}

export class MeasurementHierarchyDto {
  @ApiProperty({
    example: 'reactor_outlet',
    description: 'The slice measurement boundary',
  })
  @Matches(BOUNDARY, { message: 'boundary is 1-64 letters, digits, _ . -' })
  boundary: string;

  @ApiProperty({
    enum: CONDITIONS,
    isArray: true,
    description: 'When a lower rank may replace a better one',
  })
  @IsArray()
  @IsIn(CONDITIONS, { each: true })
  conditions: FallbackCondition[];

  @ApiProperty({ type: [HierarchyEntryDto], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HierarchyEntryDto)
  entries: HierarchyEntryDto[];
}

/** Body of POST /source-authority/versions (SME E7). */
export class SourceAuthorityVersionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit override; absent = the tenant-wide version',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({
    type: MeasurementHierarchyDto,
    nullable: true,
    description:
      'Ranked sources; null = back to primary / fallback. The top rank becomes primarySource.',
  })
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => MeasurementHierarchyDto)
  measurementHierarchy: MeasurementHierarchyDto | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SourceAuthorityQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit whose version in force is read; absent = tenant-wide',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class SourceAuthorityVersionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Versions of this unit only; absent = every scope the caller sees',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: SOURCE_AUTHORITY_VERSION_STATES })
  @IsOptional()
  @IsIn(SOURCE_AUTHORITY_VERSION_STATES)
  state?: SourceAuthorityVersionState;
}
