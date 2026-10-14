import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  toArrayParam,
  toBooleanParam,
} from '../../common/dto/query-param.transformers';
import {
  DICTIONARY_KINDS,
  DictionaryKind,
} from '../../domain/reliability/failure-dictionary';
import { MAX_DICTIONARY_ROWS } from '../../domain/reliability/failure-dictionary-import';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';

export const DICTIONARY_STATUSES = ['current', 'all'] as const;

export class FailureDictionaryListQueryDto extends MasterDataListQueryDto {
  @ApiPropertyOptional({
    enum: DICTIONARY_KINDS,
    isArray: true,
    description: 'Entries of these kinds only (repeat the parameter)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(DICTIONARY_KINDS, { each: true })
  kinds?: DictionaryKind[];

  @ApiPropertyOptional({
    maxLength: 50,
    description:
      'Items and modes of this equipment class and those valid for every class',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipmentClass?: string;

  @ApiPropertyOptional({
    description:
      'Instant the entries are in force at (default now); ignored with `history=true`',
  })
  @IsOptional()
  @IsISO8601()
  at?: string;

  @ApiPropertyOptional({
    description: 'true = every version, also ended ones (default false)',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  history?: boolean;
}

class DictionaryContentDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    example: 'Mechanical failure',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Equipment classes only: asset types the class covers',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  assetTypes?: string[];

  @ApiPropertyOptional({
    description: 'The "unknown / investigation pending" choice of its list',
  })
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;

  @ApiPropertyOptional({
    description: 'Start of this version (default now)',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}

export class FailureDictionaryCreateDto extends DictionaryContentDto {
  @ApiProperty({ enum: DICTIONARY_KINDS })
  @IsIn(DICTIONARY_KINDS)
  kind: DictionaryKind;

  @ApiPropertyOptional({
    maxLength: 50,
    description:
      'Maintainable items and failure modes: code of their equipment class (empty = every class)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipmentClass?: string;

  @ApiProperty({ maxLength: 50, example: 'ELP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ maxLength: 255, example: 'External leakage – process medium' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

/** A change is a new version of the entry from `effectiveFrom` (kind, class and code stay). */
export class FailureDictionaryChangeDto extends DictionaryContentDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}

export class FailureDictionaryRetireDto {
  @ApiPropertyOptional({ description: 'End of the entry (default now)' })
  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

/** One import row; the importer checks the values and reports problems by row. */
export class FailureDictionaryRowDto {
  @ApiPropertyOptional({ enum: DICTIONARY_KINDS })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assetTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPending?: boolean;
}

export class FailureDictionaryImportDto {
  @ApiPropertyOptional({
    type: [FailureDictionaryRowDto],
    maxItems: MAX_DICTIONARY_ROWS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DICTIONARY_ROWS)
  @ValidateNested({ each: true })
  @Type(() => FailureDictionaryRowDto)
  entries?: FailureDictionaryRowDto[];

  @ApiPropertyOptional({
    description:
      'CSV with a header row: kind,equipmentClass,code,name,description,category,assetTypes,isPending ' +
      '(assetTypes separated by ";", isPending yes/no)',
    maxLength: 2_000_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  csv?: string;

  @ApiPropertyOptional({
    description: 'Start of new and changed entries (default now)',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description: 'true = check and count only, store nothing',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
