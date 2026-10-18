import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class EquipmentReadinessQueryDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() unitId: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  from: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  to: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;
  @ApiPropertyOptional({ default: 'normal', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  operatingMode?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  connectionId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
