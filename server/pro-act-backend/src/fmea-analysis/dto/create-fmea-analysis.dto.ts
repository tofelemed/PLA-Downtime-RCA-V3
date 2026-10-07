import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateFMEAAnalysisDto {
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

  @ApiProperty({ description: 'Analysis name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  analysisName?: string;

  @ApiProperty({ description: 'Failure modes (JSON)', required: false })
  @IsOptional()
  @IsString()
  failureModes?: string;
}

