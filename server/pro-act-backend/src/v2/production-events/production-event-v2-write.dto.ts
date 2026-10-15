import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDecimal,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  IMPACT_MODES,
  OEE_COMPONENTS,
  PHYSICAL_TYPES,
  SCHEDULE_CLASSES,
} from '../../domain/events/event-classification';
import {
  EVENT_DISPOSITION_CLASSES,
  EventDispositionClass,
} from './disposition-class';
import { FAILURE_SEVERITIES } from './failure-detail';

const DECIMAL = { decimal_digits: '0,8' };

/**
 * Fields a user may set on a manual event and edit later (DT08). `null` clears a nullable field on
 * PATCH. Decimals are strings (API03).
 */
export class ProductionEventV2EditableDto {
  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Exclusive end; omit or null for an open event',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  endTime?: string | null;

  @ApiPropertyOptional({
    description:
      'Alternative to endTime: seconds from start (must agree with endTime within 1 s)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assetId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'SME D3: unit whose failure caused this stop (starved / blocked by another unit); null = this unit',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  originUnitId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'SME D3: asset whose failure caused this stop (of the origin unit when one is given)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  originAssetId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Reason (cause) code',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  reasonCodeId?: string | null;

  @ApiPropertyOptional({ enum: PHYSICAL_TYPES })
  @IsOptional()
  @IsIn(PHYSICAL_TYPES)
  physicalType?: (typeof PHYSICAL_TYPES)[number];

  @ApiPropertyOptional({ enum: SCHEDULE_CLASSES })
  @IsOptional()
  @IsIn(SCHEDULE_CLASSES)
  scheduleClass?: (typeof SCHEDULE_CLASSES)[number];

  @ApiPropertyOptional({ enum: OEE_COMPONENTS })
  @IsOptional()
  @IsIn(OEE_COMPONENTS)
  oeeComponent?: (typeof OEE_COMPONENTS)[number];

  @ApiPropertyOptional({ enum: IMPACT_MODES })
  @IsOptional()
  @IsIn(IMPACT_MODES)
  impactMode?: (typeof IMPACT_MODES)[number];

  @ApiPropertyOptional({
    example: '0.25',
    nullable: true,
    description: '0..1, required when impactMode = fractional',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDecimal(DECIMAL)
  impactFraction?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'LA-08: product before a grade change; required with toProductId on grade_transition events only',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  fromProductId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'LA-08: product after a grade change (grade_transition only)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  toProductId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'SME Q10: the stop (downtime of the same unit) a ramp-up or startup-quality event recovers from; its loss is charged to that stop',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  recoveryOfEventId?: string | null;

  @ApiPropertyOptional({
    enum: EVENT_DISPOSITION_CLASSES,
    nullable: true,
    description:
      'SME E3: disposition of the tonnes a quality_loss event explains (downgrade sold at a discount, scrap, rework); quality_loss only',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(EVENT_DISPOSITION_CLASSES)
  dispositionClass?: EventDispositionClass | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description:
      "SME D4: approved end of a planned stop's window; time after it counts as unplanned maintenance overrun",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  plannedEndTime?: string | null;

  @ApiPropertyOptional({
    maxLength: 255,
    nullable: true,
    description: 'SME D11: failure mode, e.g. external leakage',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  failureMode?: string | null;

  @ApiPropertyOptional({
    enum: FAILURE_SEVERITIES,
    nullable: true,
    description:
      'SME D8: critical / degraded count as functional failures (MTBF); incipient does not; null = pending',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(FAILURE_SEVERITIES)
  failureSeverity?: (typeof FAILURE_SEVERITIES)[number] | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'SME D11: maintainable item',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  maintainableItem?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'SME D11: failure mechanism',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  failureMechanism?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'SME D11: failure cause',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  failureCause?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'SME D11: detection method',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  detectionMethod?: string | null;

  @ApiPropertyOptional({
    description:
      'SME D12: no specific reason yet — the stop is explicitly under investigation (meets the per-stop rule of the shift submission gate, not the coded-time target)',
  })
  @IsOptional()
  @IsBoolean()
  investigationPending?: boolean;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ example: '12.5', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDecimal(DECIMAL)
  quantity?: string | null;

  @ApiPropertyOptional({ example: 't', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  quantityUom?: string | null;

  @ApiPropertyOptional({ example: '1500.00', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDecimal(DECIMAL)
  cost?: string | null;
}

/** `POST /api/v2/production-events` (DT08 manual create). The tenant comes from the identity. */
export class CreateProductionEventV2Dto extends ProductionEventV2EditableDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ format: 'date-time', description: 'Inclusive start (UTC)' })
  @IsISO8601({ strict: true })
  startTime!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({
    description:
      'Legacy v1 type label (ProductionLoss, IOW, ...); sets default classifications',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  eventType?: string;

  @ApiPropertyOptional({ description: 'Caller reference, unique per source' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventId?: string;
}

/** `PATCH /api/v2/production-events/{id}` with `If-Match`; interval edits only on manual events. */
export class PatchProductionEventV2Dto extends ProductionEventV2EditableDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startTime?: string;
}
