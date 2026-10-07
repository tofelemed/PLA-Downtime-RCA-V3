import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FiveWhyLevelDto {
  @ApiProperty({ description: 'Hierarchy level (1..n)' })
  @IsInt()
  level: number;

  @ApiProperty({ description: 'Why question' })
  @IsString()
  question: string;

  @ApiProperty({ description: 'Answer' })
  @IsString()
  answer: string;

  @ApiProperty({ description: 'Justification', required: false })
  @IsOptional()
  @IsString()
  justification?: string;

  @ApiProperty({ description: 'Evidence references', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}

export class CreateFiveWhyAnalysisDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({ description: 'Associated RCA ID' })
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty({ description: 'Problem statement' })
  @IsString()
  problem: string;

  @ApiProperty({ description: 'Why levels', type: [FiveWhyLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiveWhyLevelDto)
  whyLevels: FiveWhyLevelDto[];

  @ApiProperty({ description: 'Root cause identified' })
  @IsString()
  rootCause: string;

  @ApiProperty({ description: 'Verified by user', required: false })
  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @ApiProperty({ description: 'Verification date ISO string', required: false })
  @IsOptional()
  @IsString()
  verifiedDate?: string;
}


