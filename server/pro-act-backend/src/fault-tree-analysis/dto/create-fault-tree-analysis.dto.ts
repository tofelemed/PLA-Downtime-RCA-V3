import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateFaultTreeAnalysisDto {
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

  @ApiProperty({ description: 'Top event', required: false })
  @IsOptional()
  @IsString()
  topEvent?: string;

  @ApiProperty({ description: 'Tree data (JSON)', required: false })
  @IsOptional()
  @IsString()
  treeData?: string;
}

