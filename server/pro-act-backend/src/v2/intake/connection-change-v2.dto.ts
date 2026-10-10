import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Body of PATCH /connections/{id}: only the listed fields change (plan 3.7). */
export class UpdateConnectionV2Dto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'The whole new endpoint configuration (replaces the stored one). Credential-like keys are 422 ' +
      'SECRET_IN_CONFIG; the adapter validates it (422 INVALID_ENDPOINT_CONFIG).',
  })
  @IsOptional()
  @IsObject()
  endpointConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    maxLength: 4096,
    description:
      'Replaces the stored credential (write-only; never returned). Omit to keep the current one.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  secret?: string;

  @ApiPropertyOptional({
    description: 'false deactivates the connection (its jobs stay as they are)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export const SAMPLE_SCOPE_TYPES = ['database', 'element'] as const;

/** GET /connections/{id}/sample: a bounded read of recent source records (discovery, PI02 preview). */
export class ConnectionSampleQueryV2Dto {
  @ApiProperty({
    enum: SAMPLE_SCOPE_TYPES,
    description: 'PI: search an AF database or one element',
  })
  @IsIn(SAMPLE_SCOPE_TYPES)
  scopeType: (typeof SAMPLE_SCOPE_TYPES)[number];

  @ApiProperty({ description: 'PI: AF database or element WebId' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  scopeId: string;

  @ApiPropertyOptional({ description: 'Only records of this template' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  templateName?: string;

  @ApiProperty({ description: 'Window start, ISO 8601 (inclusive)' })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({
    description: 'Window end, ISO 8601 (exclusive); at most 31 days after from',
  })
  @IsISO8601({ strict: true })
  to: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
