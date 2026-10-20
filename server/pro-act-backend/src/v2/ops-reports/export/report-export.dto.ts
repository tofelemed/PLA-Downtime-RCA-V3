import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DEFAULT_PDF_CURRENCY,
  PDF_CURRENCIES,
  PdfCurrency,
} from '../../../exports/pdf/pdf-model';

export const REPORT_EXPORT_FORMATS = ['pdf', 'xlsx'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

/** `POST /reports/{kind}/export` body: the file format and the currency money is printed in. */
export class ReportExportBodyDto {
  @ApiProperty({
    enum: REPORT_EXPORT_FORMATS,
    description:
      '`pdf`: a designed report (logo, title, KPIs, tables) on the plant calendar; `xlsx`: a workbook, a sheet per table',
  })
  @IsIn(REPORT_EXPORT_FORMATS)
  format: ReportExportFormat = 'pdf';

  @ApiPropertyOptional({
    enum: PDF_CURRENCIES,
    description: `The reporting currency money is printed in (default ${DEFAULT_PDF_CURRENCY})`,
  })
  @IsOptional()
  @IsIn(PDF_CURRENCIES)
  currency?: PdfCurrency;
}
