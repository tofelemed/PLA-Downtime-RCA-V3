import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import {
  REQUESTABLE_FORMATS,
  REQUESTABLE_REPORT_TYPES,
  REQUESTABLE_SELECTORS,
  ExportFormat,
  ExportReportType,
  ExportSelector,
} from '../../exports/entities/export-job.entity';
import {
  DEFAULT_PDF_CURRENCY,
  PDF_CURRENCIES,
  PdfCurrency,
} from '../../exports/pdf/pdf-model';
import { LIST_LIMIT_MAX, ListQueryDto } from '../common/list-query.dto';

/** `POST /exports` (§15.2): report, format, revision selector and its filters. */
export class CreateExportDto {
  @ApiProperty({
    enum: REQUESTABLE_REPORT_TYPES,
    description:
      '`period_summary` / `loss_lines`: approved period revisions. `rca_case`: one RCA case as a PDF (definition, ' +
      'team, status timeline, causes, analyses, actions with verification, approved / claimed / realised figures, ' +
      'closure approval), with revisionSelector `case` and `rcaId`; a case the caller cannot read is 404.',
  })
  @IsIn(REQUESTABLE_REPORT_TYPES)
  reportType: ExportReportType;

  @ApiProperty({
    enum: REQUESTABLE_FORMATS,
    description:
      '`csv`: every column, ISO UTC times, both reporting currencies. `pdf`: a printable report on the ' +
      'plant clock, calendar and digits, money in `currency`; at most EXPORT_PDF_MAX_SOURCES (500) period ' +
      'revisions (422 EXPORT_TOO_LARGE).',
  })
  @IsIn(REQUESTABLE_FORMATS)
  format: ExportFormat;

  @ApiPropertyOptional({
    enum: PDF_CURRENCIES,
    description: `PDF only: the reporting currency money is printed in (default ${DEFAULT_PDF_CURRENCY}). Ignored for CSV.`,
  })
  @IsOptional()
  @IsIn(PDF_CURRENCIES)
  currency?: PdfCurrency;

  @ApiProperty({
    enum: REQUESTABLE_SELECTORS,
    description:
      '`published`: the latest approved revision of every period overlapping [from, to) (needs from/to, optional ' +
      'unitIds). `revision_ids`: the named approved revisions (needs revisionIds only). Draft or in-review ' +
      'content is never exported. `case`: reportType rca_case only (needs rcaId only; PDF only, 422 ' +
      'FORMAT_NOT_SUPPORTED for CSV).',
  })
  @IsIn(REQUESTABLE_SELECTORS)
  revisionSelector: ExportSelector;

  @ApiPropertyOptional({ description: 'Window start (inclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Window end (exclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Units to export; omitted = every unit (needs a tenant-wide grant)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Approved revision ids (revision_ids selector)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  revisionIds?: string[];

  @ApiPropertyOptional({
    description: 'The RCA case to export (reportType rca_case only)',
  })
  @IsOptional()
  @IsUUID()
  rcaId?: string;
}

/** `GET /exports`: newest first. */
export class ExportListQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: LIST_LIMIT_MAX, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_LIMIT_MAX)
  limit: number = 100;
}

/** `GET /exports/{id}/sources`: pinned revisions in render order. */
export class ExportSourcesQueryDto extends ExportListQueryDto {}

/** `GET /deliveries/reconciliation`: revisions approved in [from, to). */
export class DeliveryReconciliationQueryDto extends ListQueryDto {
  @ApiProperty({
    description: 'Approval time window start (inclusive), ISO 8601',
  })
  @IsISO8601()
  from: string = '';

  @ApiProperty({
    description: 'Approval time window end (exclusive), ISO 8601',
  })
  @IsISO8601()
  to: string = '';

  @ApiPropertyOptional({ enum: ['approvedAt'] })
  @IsOptional()
  @IsIn(['approvedAt'])
  sort?: string = undefined;

  @ApiPropertyOptional({
    type: [String],
    description: 'Repeat to filter by several units',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];
}
