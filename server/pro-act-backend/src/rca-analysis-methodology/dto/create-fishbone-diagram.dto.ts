import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FishboneCauseDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsBoolean()
  isPrimary: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  likelihood?: string;
}

class FishboneCategoryDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ type: [FishboneCauseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FishboneCauseDto)
  causes: FishboneCauseDto[];
}

export class CreateFishboneDiagramDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty()
  @IsString()
  effect: string;

  @ApiProperty({ type: [FishboneCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FishboneCategoryDto)
  categories: FishboneCategoryDto[];
}


