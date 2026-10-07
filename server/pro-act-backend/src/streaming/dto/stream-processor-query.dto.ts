import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class StreamProcessorQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by processor type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by enabled flag' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}


