import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StreamMetricQueryDto {
  @ApiPropertyOptional({ description: 'Limit the number of records returned', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

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
}


