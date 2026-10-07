import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateChangeAnalysisDto {
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

  @ApiProperty({ description: 'Change description', required: false })
  @IsOptional()
  @IsString()
  changeDescription?: string;

  @ApiProperty({ description: 'Changes (JSON)', required: false })
  @IsOptional()
  @IsString()
  changes?: string;
}

