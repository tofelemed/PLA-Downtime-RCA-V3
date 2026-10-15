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
  EXPORT_FORMATS,
  EXPORT_REPORT_TYPES,
  EXPORT_SELECTORS,
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
  @ApiProperty({ enum: EXPORT_REPORT_TYPES })
  @IsIn(EXPORT_REPORT_TYPES)
  reportType: ExportReportType;

  @ApiProperty({
    enum: EXPORT_FORMATS,
    description:
      '`csv`: every column, ISO UTC times, both reporting currencies. `pdf`: a printable report on the ' +
      'plant clock, calendar and digits, money in `currency`; at most EXPORT_PDF_MAX_SOURCES (500) period ' +
      'revisions (422 EXPORT_TOO_LARGE).',
  })
  @IsIn(EXPORT_FORMATS)
  format: ExportFormat;

  @ApiPropertyOptional({
    enum: PDF_CURRENCIES,
    default: DEFAULT_PDF_CURRENCY,
    description:
      'PDF only: the reporting currency money is printed in (USD by default). Ignored for CSV.',
  })
  @IsOptional()
  @IsIn(PDF_CURRENCIES)
  currency?: PdfCurrency;

  @ApiProperty({
    enum: EXPORT_SELECTORS,
    description:
      '`published`: the latest approved revision of every period overlapping [from, to) (needs from/to, optional ' +
      'unitIds). `revision_ids`: the named approved revisions (needs revisionIds only). Draft or in-review ' +
      'content is never exported.',
  })
  @IsIn(EXPORT_SELECTORS)
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
