import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  OEE_COMPONENTS,
  OeeComponent,
  SCHEDULE_CLASSES,
  ScheduleClass,
} from '../../domain/events/event-classification';
import { MAX_REASON_WEIGHTS } from '../../domain/events/reason-weights';
import { ReasonWeightInputDto } from './reason-weights.dto';

/** Largest bulk-coding request; above 500 it runs as a job (API04). */
export const MAX_BULK_ITEMS = 10_000;
/** Largest merge (events of one stop). */
export const MAX_MERGE_EVENTS = 50;
/** Largest gap a merge policy may bridge (one day). */
export const MAX_GAP_SECONDS = 86_400;

class OperationReasonDto {
  @ApiProperty({ maxLength: 1000, description: 'Why (kept in the revisions)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

/** `POST /api/v2/production-events/{id}/split` (with `If-Match`). */
export class SplitEventV2Dto extends OperationReasonDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Strictly inside the event (before now while it is open)',
  })
  @IsISO8601({ strict: true })
  splitAt!: string;
}

/** `POST /api/v2/production-events/{id}/close` (with `If-Match`). */
export class CloseEventV2Dto extends OperationReasonDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Exclusive end: after the start, not in the future',
  })
  @IsISO8601({ strict: true })
  endTime!: string;
}

/** `POST /api/v2/production-events/{id}/retract` (with `If-Match`). */
export class RetractEventV2Dto {
  @ApiProperty({
    maxLength: 500,
    description: 'Why the event is retracted (kept in the retraction revision)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

/** An event and the `rowVersion` (ETag) the caller read. */
export class EventVersionRefDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** `POST /api/v2/production-events/merge` */
export class MergeEventsV2Dto extends OperationReasonDto {
  @ApiProperty({ type: [EventVersionRefDto], minItems: 2, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(MAX_MERGE_EVENTS)
  @ValidateNested({ each: true })
  @Type(() => EventVersionRefDto)
  events!: EventVersionRefDto[];

  @ApiPropertyOptional({
    default: 0,
    maximum: MAX_GAP_SECONDS,
    description:
      'Largest gap between consecutive events that still merges (0 = adjacent or overlapping only)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_GAP_SECONDS)
  maxGapSeconds?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Merge events with different physical types or schedule classes (the earliest event wins)',
  })
  @IsOptional()
  @IsBoolean()
  overrideClassification?: boolean;
}

/** Codes a bulk command applies; a reason code brings its classification defaults. */
export class BulkCodesDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Reason (cause) code' })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiPropertyOptional({ enum: SCHEDULE_CLASSES })
  @IsOptional()
  @IsIn(SCHEDULE_CLASSES)
  scheduleClass?: ScheduleClass;

  @ApiPropertyOptional({ enum: OEE_COMPONENTS })
  @IsOptional()
  @IsIn(OEE_COMPONENTS)
  oeeComponent?: OeeComponent;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Equipment (asset) of every event’s unit (422 INVALID_REFERENCE otherwise); on source events the value is ' +
      'recorded as a source override, as with a single PATCH',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    description:
      'SME D12: no specific reason yet — the stops are explicitly under investigation (false clears the flag)',
  })
  @IsOptional()
  @IsBoolean()
  investigationPending?: boolean;

  @ApiPropertyOptional({
    type: [ReasonWeightInputDto],
    maxItems: MAX_REASON_WEIGHTS,
    description:
      'D-T5: split every selected stop across these reasons by percent (Σ 100; seconds are refused because the ' +
      'stops differ in length). The largest becomes reasonCodeId. 422 REASON_WEIGHTS_* on a broken rule',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REASON_WEIGHTS)
  @ValidateNested({ each: true })
  @Type(() => ReasonWeightInputDto)
  reasonWeights?: ReasonWeightInputDto[];
}

/** `POST /api/v2/production-events/bulk-code` */
export class BulkCodeV2Dto extends OperationReasonDto {
  @ApiProperty({ type: [EventVersionRefDto], minItems: 1, maxItems: 10000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => EventVersionRefDto)
  items!: EventVersionRefDto[];

  @ApiProperty({ type: BulkCodesDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BulkCodesDto)
  codes!: BulkCodesDto;

  @ApiProperty({
    description:
      'true: report before/after, exclusions and affected windows without changing anything',
  })
  @IsBoolean()
  preview!: boolean;
}
