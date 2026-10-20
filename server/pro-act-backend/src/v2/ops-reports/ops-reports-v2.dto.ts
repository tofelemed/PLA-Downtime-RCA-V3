import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { SHIFT_NOTE_MAX } from '../../shift-notes/shift-note.entity';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';

export const PRODUCTION_GROUPS = [
  'total',
  'day',
  'week',
  'month',
  'unit',
] as const;
export type ProductionGroup = (typeof PRODUCTION_GROUPS)[number];

/** `GET /reports/production-by-product` (R1, R11): output, quality classes and plan per product. */
export class ProductionByProductQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    enum: PRODUCTION_GROUPS,
    default: 'total',
    description:
      'Rows per product and this group: the window (`total`), the plant day, week or month, or the unit',
  })
  @IsOptional()
  @IsIn(PRODUCTION_GROUPS)
  groupBy?: ProductionGroup;
}

/** `GET /reports/event-status` (R1, R2, R9): coding and verification state of the window's events. */
export class EventStatusQueryDto extends ReportWindowQueryDto {}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `GET /reports/shift-handover` (R2): one shift of the plant calendar, on the caller's units. */
export class ShiftHandoverQueryDto {
  @ApiProperty({
    example: '2026-10-19',
    description: 'Plant date of the shift (YYYY-MM-DD)',
  })
  @Matches(LOCAL_DATE, { message: 'localDate must be YYYY-MM-DD' })
  localDate: string = '';

  @ApiProperty({
    example: 'A',
    description: 'Shift label as the calendar names it',
  })
  @IsString()
  @Length(1, 64)
  shiftName: string = '';

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several units; units of the tenant and of the caller’s scope (422 INVALID_REFERENCE). ' +
      'Omitted: every unit the caller may read.',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];
}

/** `POST /shift-notes` (R2): a handover note of one unit's shift; append-only. */
export class CreateShiftNoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string = '';

  @ApiProperty({ example: '2026-10-19' })
  @Matches(LOCAL_DATE, { message: 'localDate must be YYYY-MM-DD' })
  localDate: string = '';

  @ApiProperty({ example: 'A' })
  @IsString()
  @Length(1, 64)
  shiftName: string = '';

  @ApiProperty({ maxLength: SHIFT_NOTE_MAX })
  @IsString()
  @Length(1, SHIFT_NOTE_MAX)
  body: string = '';
}

/** `GET /reports/restatements` (R3): restatements of the periods starting in the window. */
export class RestatementsQueryDto extends ReportWindowQueryDto {}

/** `GET /reports/quality-dispositions` (R4): lot dispositions of lots produced in the window. */
export class QualityDispositionsQueryDto extends ReportWindowQueryDto {}

/** `GET /reports/transition-performance` (R5): grade transitions starting in the window. */
export class TransitionPerformanceQueryDto extends ReportWindowQueryDto {}

/** `GET /reports/reliability-trend` (R6): MTBF, restore and repair means per plant month. */
export class ReliabilityTrendQueryDto extends ReportWindowQueryDto {}
