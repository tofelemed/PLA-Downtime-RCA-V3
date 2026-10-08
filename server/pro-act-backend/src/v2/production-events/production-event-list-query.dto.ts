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
} from '../../domain/events/event-classification';
import { ListQueryDto } from '../common/list-query.dto';

/** Repeated enum filter: `?physicalTypes=downtime&physicalTypes=slowdown` (OR within). */
function EnumArrayParam(values: readonly string[]): PropertyDecorator {
  return (target, key) => {
    ApiPropertyOptional({ type: [String], enum: values })(target, key);
    IsOptional()(target, key);
    Transform(toArrayParam)(target, key);
    IsArray()(target, key);
    ArrayMaxSize(values.length)(target, key);
    IsIn(values, { each: true })(target, key);
  };
}

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

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: still running (no end time); false: ended',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  isOpen?: boolean;
}
