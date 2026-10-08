import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import {
  MAPPING_TARGET_TYPES,
  MappingTargetType,
  MATCH_KINDS,
  MatchKind,
} from '../../source-mapping/mapping-rule';
import { ListQueryDto } from '../common/list-query.dto';

/** Body of POST /source-mappings and PUT /source-mappings/{id} (the whole rule). */
export class SourceMappingV2WriteDto {
  @ApiProperty({
    enum: MATCH_KINDS,
    description:
      'exact_id → exact_path → pattern → af_binding (resolution order). Paths and patterns: `\\` and `/` ' +
      'are separators, case-insensitive; `*` any run, `?` one character, `[*]` `[?]` `[[]` literals.',
  })
  @IsIn(MATCH_KINDS)
  matchKind: MatchKind;

  @ApiProperty({
    description: 'Source id, path, glob pattern or AF element WebId',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  matchValue: string;

  @ApiProperty({ enum: MAPPING_TARGET_TYPES })
  @IsIn(MAPPING_TARGET_TYPES)
  targetType: MappingTargetType;

  @ApiProperty({
    format: 'uuid',
    description: 'Unit or asset of the caller tenant',
  })
  @IsUUID()
  targetId: string;

  @ApiPropertyOptional({
    description:
      'Patterns: higher is evaluated first; equal precedence with different targets is ambiguous',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  precedence?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null = every connection',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  connectionId?: string | null;

  @ApiPropertyOptional({
    default: 'PI',
    description: "'PI', 'MQTT', ... or '*'",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceSystem?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  effectiveFrom?: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Exclusive end',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  effectiveTo?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class MappingSampleDto {
  @ApiPropertyOptional({ description: 'Source id (e.g. the PI element WebId)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceId?: string;

  @ApiPropertyOptional({
    description: 'Source path (e.g. \\\\AF\\HDPE\\unit100\\Extruder)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourcePath?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'AF element WebIds: the referenced element first, then its ancestors',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  afElementWebIds?: string[];
}

export class SourceMappingPreviewDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Connection whose rules apply (default: rules for every connection)',
  })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiProperty({ type: [MappingSampleDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MappingSampleDto)
  samples: MappingSampleDto[];
}

export class SourceMappingListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt'])
  sort?: string = undefined;

  @ApiPropertyOptional({ enum: MATCH_KINDS })
  @IsOptional()
  @IsIn(MATCH_KINDS)
  matchKind?: MatchKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Include inactive rules',
    default: false,
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeInactive?: boolean;
}
