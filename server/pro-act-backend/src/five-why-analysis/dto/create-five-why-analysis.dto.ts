import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

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

  @ApiProperty({ description: 'RCA ID' })
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty({ description: 'Problem statement', required: false })
  @IsOptional()
  @IsString()
  problemStatement?: string;

  @ApiProperty({ description: 'Why levels (JSON)', required: false })
  @IsOptional()
  @IsString()
  whyLevels?: string;

  @ApiProperty({ description: 'Root cause', required: false })
  @IsOptional()
  @IsString()
  rootCause?: string;
}

