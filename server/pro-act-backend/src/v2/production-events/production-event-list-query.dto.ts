import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import {
  toArrayParam,
  toBooleanParam,
} from '../../common/dto/query-param.transformers';
import {
  CODING_STATES,
  OEE_COMPONENTS,
  PHYSICAL_STATES,
  PHYSICAL_TYPES,
  RCA_STATES,
  SCHEDULE_CLASSES,
  SOURCE_KINDS,
} from '../../domain/events/event-classification';
import { EnumArrayParam } from '../common/enum-array-param';
import { ListQueryDto } from '../common/list-query.dto';

export const PRODUCTION_EVENT_SORT_FIELDS = ['startTime'] as const;
export type ProductionEventSortField =
  (typeof PRODUCTION_EVENT_SORT_FIELDS)[number];
const SORT_OPTIONS = ['startTime', '-startTime'] as const;

/** `GET /api/v2/production-events` filters: AND between parameters, OR within a repeated parameter. */
export class ProductionEventListQueryDto extends ListQueryDto {
  // Redeclared with an initializer (TS2612) so the resource-specific allowlist applies on top of the base validators.
  @ApiPropertyOptional({ enum: SORT_OPTIONS, default: '-startTime' })
  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort?: string = undefined;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Repeat the parameter for several units',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  assetIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Reason code ids',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  reasonIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  statuses?: string[];

  @EnumArrayParam(PHYSICAL_TYPES)
  physicalTypes?: string[];

  @EnumArrayParam(SCHEDULE_CLASSES)
  scheduleClasses?: string[];

  @EnumArrayParam(OEE_COMPONENTS)
  oeeComponents?: string[];

  @EnumArrayParam(PHYSICAL_STATES)
  physicalStates?: string[];

  @EnumArrayParam(CODING_STATES)
  codingStates?: string[];

  @EnumArrayParam(RCA_STATES)
  rcaStates?: string[];

  @EnumArrayParam(SOURCE_KINDS)
  sourceKinds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Severity labels as stored (e.g. Critical, High, Medium, Low); repeat for several',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  severities?: string[];

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 100,
    description:
      'Case-insensitive text contained in the description or the business event id. Meant to be combined ' +
      'with a from/to window (an unbounded text search scans every event of the scope).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  q?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: still running (no end time, not superseded or retracted); false: ended, superseded or retracted',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: live stops (downtime) that overlap another live stop of the same asset, or of the same unit when ' +
      'neither has an asset — usually the same stop entered twice (e.g. manually and from PI); false: every ' +
      'other event (DT-04)',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  possibleDuplicate?: boolean;
}
