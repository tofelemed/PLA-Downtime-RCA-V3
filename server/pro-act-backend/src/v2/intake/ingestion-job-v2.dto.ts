import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  INGESTION_JOB_STATES,
  IngestionJobState,
} from '../../intake/entities/ingestion-job.entity';
import { ListQueryDto } from '../common/list-query.dto';

export class JobCadenceV2Dto {
  @ApiProperty({
    minimum: 5,
    maximum: 86400,
    description: 'Seconds between pages when caught up',
  })
  @IsInt()
  @Min(5)
  @Max(86400)
  intervalSeconds: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5000, default: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  pageSize?: number;
}

/** Body of POST /connections/{id}/jobs. */
export class CreateIngestionJobV2Dto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Adapter scope (PI: scopeType, scopeId, templateName, lookbackMinutes). One active job per connection and scope.',
  })
  @IsObject()
  scope: Record<string, unknown>;

  @ApiPropertyOptional({ type: JobCadenceV2Dto })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobCadenceV2Dto)
  cadence?: JobCadenceV2Dto;

  @ApiPropertyOptional({
    description: 'Start the job right away',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  start?: boolean;
}

/** GET /ingestion-jobs: keyset pages on (createdAt, id). */
export class IngestionJobListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional({ enum: INGESTION_JOB_STATES })
  @IsOptional()
  @IsIn(INGESTION_JOB_STATES)
  state?: IngestionJobState;
}

/** Body of POST /connections/{id}/replays. */
export class CreateReplayV2Dto {
  @ApiProperty({
    maxLength: 1000,
    description: 'Why the replay runs (audited)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional({
    description: 'Window start on the source observation time (inclusive)',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Window end (exclusive)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  sourceObjectIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  exceptionIds?: string[];

  @ApiPropertyOptional({
    description: 'Count what would be replayed without replaying',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

/** Body of POST /ingestion-jobs/{id}/{action}; the reason is kept in the audit trail. */
export class JobCommandV2Dto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
