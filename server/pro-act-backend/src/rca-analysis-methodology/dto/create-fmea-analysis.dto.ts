import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FmeaEffectDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsInt()
  severity: number;

  @ApiProperty()
  @IsString()
  currentControls: string;

  @ApiProperty()
  @IsInt()
  detection: number;
}

class FmeaCauseDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsInt()
  occurrence: number;

  @ApiProperty()
  @IsInt()
  rpn: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recommendedActions: string[];
}

export class CreateFmeaAnalysisDto {
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
  failureMode: string;

  @ApiProperty({ type: [FmeaEffectDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FmeaEffectDto)
  effects: FmeaEffectDto[];

  @ApiProperty({ type: [FmeaCauseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FmeaCauseDto)
  causes: FmeaCauseDto[];
}


