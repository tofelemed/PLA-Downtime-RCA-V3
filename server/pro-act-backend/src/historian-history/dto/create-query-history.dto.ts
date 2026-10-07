import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsDateString, MaxLength } from 'class-validator';

export class CreateQueryHistoryDto {
  @ApiProperty({ description: 'Query timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Query attributes (JSON array)' })
  @IsString()
  attributes: string;

  @ApiProperty({ description: 'Query parameters (JSON)' })
  @IsString()
  queryParams: string;

  @ApiProperty({ description: 'Result count' })
  @IsInt()
  resultCount: number;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  @MaxLength(36)
  tenantId: string;
}

