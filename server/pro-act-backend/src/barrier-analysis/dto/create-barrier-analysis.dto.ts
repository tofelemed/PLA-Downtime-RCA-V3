import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateBarrierAnalysisDto {
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

  @ApiProperty({ description: 'Hazard description', required: false })
  @IsOptional()
  @IsString()
  hazard?: string;

  @ApiProperty({ description: 'Barriers (JSON)', required: false })
  @IsOptional()
  @IsString()
  barriers?: string;
}

