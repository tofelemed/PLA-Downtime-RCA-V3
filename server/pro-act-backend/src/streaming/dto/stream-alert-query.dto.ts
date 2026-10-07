import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class StreamAlertQueryDto {
  @ApiPropertyOptional({ description: 'Filter by tenant identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by organization identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by alert type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by acknowledgement state' })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;
}


