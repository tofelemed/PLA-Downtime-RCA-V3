import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import { trimmed } from '../units/unit-v2.dto';

export const ASSET_CRITICALITIES = ['High', 'Medium', 'Low'] as const;

export class AssetV2ListQueryDto extends MasterDataListQueryDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Assets of these units only (repeat the parameter)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];
}

/** Optional descriptive fields shared by create and change (`null` clears one on change). */
class AssetV2DetailsDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, example: 'Equipment' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  assetType?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  model?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string | null;

  @ApiPropertyOptional({ enum: ASSET_CRITICALITIES, nullable: true })
  @IsOptional()
  @IsIn(ASSET_CRITICALITIES)
  criticality?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, example: 'Active' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;
}

export class AssetV2CreateDto extends AssetV2DetailsDto {
  @ApiProperty({ maxLength: 50 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Active unit of the acting plant',
  })
  @IsUUID()
  unitId: string;
}

export class AssetV2ChangeDto extends AssetV2DetailsDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Move the asset to another active unit',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
