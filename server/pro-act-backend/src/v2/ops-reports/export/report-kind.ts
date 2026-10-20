import { Type } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../../common/context/request-context';
import { ReportDocument } from '../../../exports/report/report-document';
import { PlaReportsV2Service } from '../../pla-reports/pla-reports-v2.service';
import { LossTreeQueryDto } from '../../pla-reports/pla-reports.dto';
import {
  OeeReportQueryDto,
  ReportWindowQueryDto,
} from '../../reports/kpi-reports-v2.dto';
import { KpiReportsV2Service } from '../../reports/kpi-reports-v2.service';
import { OpsReportsV2Service } from '../ops-reports-v2.service';

/** The report services a document is read through (the same reads as the Reports page). */
export interface ReportServices {
  ops: OpsReportsV2Service;
  kpi: KpiReportsV2Service;
  pla: PlaReportsV2Service;
}

export interface BuildInput<Q> {
  manager: EntityManager;
  context: RequestContext;
  query: Q;
  /** the requester may see money: value sections are included */
  money: boolean;
  services: ReportServices;
}

export interface BuiltReport {
  document: ReportDocument;
  /** the export's content scope (who may see the job): the report's units, null = tenant-wide */
  unitIds: string[] | null;
}

/** One exportable report: its query (validated like its GET endpoint) and its document builder. */
export interface ReportKind<Q extends object> {
  query: Type<Q>;
  build(input: BuildInput<Q>): Promise<BuiltReport>;
}

/** The window, units and run selection of a query, as the shared report DTOs carry them. */
export function windowOf(query: ReportWindowQueryDto): ReportWindowQueryDto {
  return Object.assign(new ReportWindowQueryDto(), {
    from: query.from,
    to: query.to,
    unitIds: query.unitIds,
    approvedOnly: query.approvedOnly,
  });
}

export function lossTreeQuery(
  query: ReportWindowQueryDto,
  options: Pick<LossTreeQueryDto, 'groupBy' | 'metric' | 'limit' | 'kinds'>,
): LossTreeQueryDto {
  return Object.assign(new LossTreeQueryDto(), windowOf(query), {
    ledger: 'plan',
    ...options,
  });
}

export function oeeQuery(
  query: ReportWindowQueryDto,
  groupBy: OeeReportQueryDto['groupBy'] = 'day',
): OeeReportQueryDto {
  return Object.assign(new OeeReportQueryDto(), windowOf(query), {
    groupBy,
    policy: 'operational',
  });
}
