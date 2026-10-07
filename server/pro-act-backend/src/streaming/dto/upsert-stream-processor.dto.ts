import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertStreamProcessorDto {
  @ApiProperty({ description: 'Unique processor identifier' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id: string;

  @ApiProperty({ description: 'Processor name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Processor type (transform, filter, aggregate, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiProperty({ description: 'Processor configuration', required: false, type: Object })
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Whether the processor is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({ description: 'Execution order', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number = 0;

  @ApiProperty({ description: 'Input schema', required: false, type: Object })
  @IsOptional()
  inputSchema?: Record<string, any>;

  @ApiProperty({ description: 'Output schema', required: false, type: Object })
  @IsOptional()
  outputSchema?: Record<string, any>;

  @ApiProperty({ description: 'Processor metadata', required: false, type: Object })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tenant identifier', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization identifier', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;
}


