import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';

export const PRODUCTION_EVENT_PAGE_SIZE_MAX = 200;

/**
 * Filters for `GET /production-events`. Every provided filter is ANDed (B1); the date window uses
 * overlap semantics so running events are included (B2). The response is always one page (`page` default 1,
 * `pageSize` default 50, at most 200; 1.6 hardening).
 */
export class ProductionEventQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Window start (ISO 8601): events still running at or after it',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Window end (ISO 8601, exclusive): events that started before it',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 36)
  tenantId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: no end time yet and not superseded or retracted; false: ended, superseded or retracted',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: PRODUCTION_EVENT_PAGE_SIZE_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCTION_EVENT_PAGE_SIZE_MAX)
  pageSize?: number;
}
