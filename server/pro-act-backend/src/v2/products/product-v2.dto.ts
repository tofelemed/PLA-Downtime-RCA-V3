import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import { trimmed } from '../units/unit-v2.dto';

export const PRODUCT_AVAILABILITIES = ['organization', 'plant'] as const;
const COST_PATTERN = /^\d{1,11}(\.\d{1,4})?$/;

export class ProductV2ListQueryDto extends MasterDataListQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Also list the products shared by every plant of the organisation (no plant). Pickers of profiles ' +
      'and plans leave it off: those need a product of the plant.',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeOrganization?: boolean;
}

class ProductV2DetailsDto {
  @ApiPropertyOptional({ maxLength: 50, nullable: true, example: 't' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  uom?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Unconfirmed legacy cost (decimal string); not used by v2 calculations',
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(COST_PATTERN, {
    message: 'legacyStandardCost must be a non-negative decimal',
  })
  legacyStandardCost?: string | null;
}

export class ProductV2CreateDto extends ProductV2DetailsDto {
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

  @ApiPropertyOptional({
    enum: PRODUCT_AVAILABILITIES,
    default: 'organization',
    description:
      'organization: shared by every plant of the organisation (the v1 model); plant: the acting plant only ' +
      '(needed to use the product in profiles and plans)',
  })
  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: (typeof PRODUCT_AVAILABILITIES)[number];
}

export class ProductV2ChangeDto extends ProductV2DetailsDto {
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
}
