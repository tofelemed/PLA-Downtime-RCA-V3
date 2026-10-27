import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  REPORT_STATES,
  ReportState,
} from '../../periods/entities/external-production-report.entity';
import { ListQueryDto } from '../common/list-query.dto';

export const EXTERNAL_REPORT_SORTS = ['-localProductionDate'] as const;

/** GET /external-production-reports: keyset pages, newest local production date first. */
export class ExternalReportListQueryDto extends ListQueryDto {
  // Redeclared with an initializer (TS2612) so the allowlist applies on top of the base validators.
  @ApiPropertyOptional({
    enum: EXTERNAL_REPORT_SORTS,
    default: '-localProductionDate',
  })
  @IsOptional()
  @IsIn(EXTERNAL_REPORT_SORTS)
  sort?: string = undefined;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Records delivered by this integration connection',
  })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional({ enum: REPORT_STATES })
  @IsOptional()
  @IsIn(REPORT_STATES)
  state?: ReportState;
}
