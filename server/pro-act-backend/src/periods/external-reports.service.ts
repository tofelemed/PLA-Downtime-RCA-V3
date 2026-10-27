import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { requireTenantRole } from '../auth/roles/require-tenant-role';
import { Site } from '../calendar/entities/site.entity';
import { SitesService } from '../calendar/sites.service';
import {
  compareRevisions,
  draftProblems,
  ExternalReportDraft,
  ExternalReportLine,
  ExternalReportSourceFigures,
  IMPORT_SOURCE,
  isReleasedStatus,
  reportsFromCsv,
} from '../domain/actuals/period/external-report';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { keysetPage } from '../v2/common/keyset-page';
import {
  invalid,
  invalidReference,
  notFound,
} from '../profiles/profile-errors';
import { assertTenantWide, periodScopeUnits } from './period-scope';
import { REPORT_IMPORTERS } from '../v2/periods/period-roles';
import { ExternalProductionReport } from './entities/external-production-report.entity';
import { SourceStatusMapping } from './entities/source-status-mapping.entity';
import { SourceStatusMappingsService } from './source-status-mappings.service';
import { requestRecalculation } from './period-recalc';

export interface ExternalReportListFilter {
  connectionId?: string;
  state?: ExternalProductionReport['state'];
  /** window [from, to), ISO 8601: records whose UTC window overlaps it */
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}

export interface Importer {
  tenantId: string;
  userId: string | null;
}

export type StoreOutcome = 'imported' | 'duplicate' | 'stale';

export interface CsvImportResult {
  imported: number;
  duplicates: number;
  stale: number;
  problems: Array<{ line: number | null; reportId?: string; message: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * External daily-production records (plan 2.4 step 4, ACT08): validated (lines of the tenant's units and
 * products, the tenant's site), certified eligibility from the status mapping, deduplicated on report id
 * + revision (same content → duplicate, different content → 409), and a later revision supersedes the
 * current one (never summed) — an earlier revision arriving late is stored already superseded. Each
 * stored record requests recalculation of the periods it covers (correction candidate).
 */
@Injectable()
export class ExternalReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sites: SitesService,
    private readonly mappings: SourceStatusMappingsService,
  ) {}

  /** A record of the caller's tenant; unit-limited callers see records with a line of their units. */
  async get(
    context: RequestContext,
    id: string,
  ): Promise<ExternalProductionReport> {
    const report = await scopedQuery(
      this.dataSource.getRepository(ExternalProductionReport),
      'r',
      { context },
    )
      .andWhere('r.id = :id', { id })
      .getOne();
    const allowed = periodScopeUnits(context);
    const visible =
      report &&
      (!allowed || report.lines.some((line) => allowed.includes(line.unitId)));
    if (!report || !visible) throw notFound('External production report');
    return report;
  }

  /**
   * Keyset page of the tenant's records, newest local production date first (id tiebreak), optionally of one
   * connection, state or window; unit-limited callers see only records with a line of their units (as `get`).
   */
  async list(
    context: RequestContext,
    filter: ExternalReportListFilter,
  ): Promise<{ items: ExternalProductionReport[]; nextCursor: string | null }> {
    const qb = scopedQuery(
      this.dataSource.getRepository(ExternalProductionReport),
      'r',
      { context },
    );
    if (filter.connectionId)
      qb.andWhere('r.connectionId = :connectionId', {
        connectionId: filter.connectionId,
      });
    if (filter.state) qb.andWhere('r.state = :state', { state: filter.state });
    if (filter.from)
      qb.andWhere('r.utcEnd > :from', { from: new Date(filter.from) });
    if (filter.to) qb.andWhere('r.utcStart < :to', { to: new Date(filter.to) });
    const allowed = periodScopeUnits(context);
    if (allowed)
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements("r"."lines") l WHERE l->>'unitId' = ANY(:scopeUnits))`,
        { scopeUnits: allowed },
      );
    return keysetPage(qb, {
      alias: 'r',
      property: 'localProductionDate',
      direction: 'DESC',
      cursor: filter.cursor,
      limit: filter.limit,
    });
  }

  /** Interactive imports are plant documents: the importer role itself must cover the plant. */
  importForContext(
    context: RequestContext,
    draft: ExternalReportDraft,
  ): Promise<{ report: ExternalProductionReport; outcome: StoreOutcome }> {
    const tenantId = requireTenantId(context);
    assertTenantWide(context, 'An external production report');
    requireTenantRole(context, REPORT_IMPORTERS);
    return this.importOne({ tenantId, userId: context.userId }, draft);
  }

  /** Trusted ingestion/worker entry; interactive callers use importForContext. */
  async importOne(
    importer: Importer,
    draft: ExternalReportDraft,
  ): Promise<{ report: ExternalProductionReport; outcome: StoreOutcome }> {
    const problems = draftProblems(draft);
    if (problems.length > 0)
      throw invalid('INVALID_REPORT', problems.join('; '));
    await this.assertReferences(importer.tenantId, draft);
    return this.dataSource.transaction((manager) =>
      this.store(manager, importer, draft),
    );
  }

  /** CSV import (worker job): each record stored or reported, never all-or-nothing across records. */
  async importCsv(importer: Importer, csv: string): Promise<CsvImportResult> {
    const parsed = reportsFromCsv(csv);
    const result: CsvImportResult = {
      imported: 0,
      duplicates: 0,
      stale: 0,
      problems: [...parsed.problems],
    };
    for (const draft of parsed.reports) {
      try {
        const { outcome } = await this.importOne(importer, draft);
        if (outcome === 'imported') result.imported += 1;
        else if (outcome === 'duplicate') result.duplicates += 1;
        else result.stale += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.problems.push({
          line: null,
          reportId: `${draft.externalReportId}@${draft.externalRevision}`,
          message,
        });
      }
    }
    return result;
  }

  private async store(
    manager: EntityManager,
    importer: Importer,
    draft: ExternalReportDraft,
  ): Promise<{ report: ExternalProductionReport; outcome: StoreOutcome }> {
    const repo = manager.getRepository(ExternalProductionReport);
    const siblings = await lockedSiblings(manager, importer, draft);
    const same = siblings.find(
      (r) => r.externalRevision === draft.externalRevision,
    );
    if (same) return { report: same, outcome: duplicateOf(same, draft) };
    const current = siblings.find((r) => r.state === 'current') ?? null;
    const newer =
      !current ||
      (compareRevisions(draft.externalRevision, current.externalRevision) ??
        1) > 0;
    const site = await this.sites.resolve(
      importer.tenantId,
      draft.siteId ?? undefined,
    );
    const mapping = await this.mappings.inForce(
      manager,
      importer.tenantId,
      draft.sourceSystem ?? IMPORT_SOURCE,
      new Date(),
    );
    const report = await repo.save(
      repo.create({
        ...reportRow(importer, draft, { site, mapping }),
        state: newer ? 'current' : 'superseded',
        supersededById: newer ? null : (current?.id ?? null),
      }),
    );
    if (!newer) return { report, outcome: 'stale' };
    if (current)
      await repo.update(current.id, {
        state: 'superseded',
        supersededById: report.id,
      });
    await this.requestRecalc(manager, importer, report, current);
    return { report, outcome: 'imported' };
  }

  private async requestRecalc(
    manager: EntityManager,
    importer: Importer,
    report: ExternalProductionReport,
    previous: ExternalProductionReport | null,
  ): Promise<void> {
    const units = [...report.lines, ...(previous?.lines ?? [])].map(
      (line) => line.unitId,
    );
    const from =
      previous && previous.utcStart < report.utcStart
        ? previous.utcStart
        : report.utcStart;
    const to =
      previous && previous.utcEnd > report.utcEnd
        ? previous.utcEnd
        : report.utcEnd;
    await requestRecalculation(manager, {
      tenantId: importer.tenantId,
      unitIds: [...new Set(units)],
      from,
      to,
      reason: previous ? 'external_report_correction' : 'external_report',
      scopeUnitIds: null,
      requestedBy: importer.userId,
    });
  }

  /** Units, products (and site) must be of the tenant: 422 INVALID_REFERENCE. */
  private async assertReferences(
    tenantId: string,
    draft: ExternalReportDraft,
  ): Promise<void> {
    const unitIds = [...new Set(draft.lines.map((line) => line.unitId))];
    const productIds = [...new Set(draft.lines.map((line) => line.productId))];
    if (unitIds.some((id) => !UUID.test(id)))
      throw invalidReference('lines.unitId', 'unit');
    if (productIds.some((id) => !UUID.test(id)))
      throw invalidReference('lines.productId', 'product');
    const units: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "units" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2`,
      [unitIds, tenantId],
    );
    if (units.length !== unitIds.length)
      throw invalidReference('lines.unitId', 'unit');
    const products: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "products" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2::uuid`,
      [productIds, tenantId.toLowerCase()],
    );
    if (products.length !== productIds.length)
      throw invalidReference('lines.productId', 'product');
    if (draft.siteId && !UUID.test(draft.siteId))
      throw invalidReference('siteId', 'site');
  }
}

/** Earlier revisions of the record, read under a per-record advisory lock (serialized imports). */
async function lockedSiblings(
  manager: EntityManager,
  importer: Importer,
  draft: ExternalReportDraft,
): Promise<ExternalProductionReport[]> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `external_report:${importer.tenantId}:${draft.externalReportId}`,
  ]);
  return manager.getRepository(ExternalProductionReport).find({
    where: {
      tenantId: importer.tenantId,
      externalReportId: draft.externalReportId,
    },
    order: { importedAt: 'ASC' },
  });
}

/**
 * The stored record: certified eligibility from the source's approved status mapping in force at import
 * (SME R13), with the mapping version kept; source id, revision and release time come with the draft.
 */
function reportRow(
  importer: Importer,
  draft: ExternalReportDraft,
  context: { site: Site; mapping: SourceStatusMapping | null },
): Partial<ExternalProductionReport> {
  const { site, mapping } = context;
  return {
    tenantId: importer.tenantId,
    externalReportId: draft.externalReportId,
    externalRevision: draft.externalRevision,
    siteId: site.id,
    localProductionDate: draft.localProductionDate,
    timezone: draft.timezone ?? site.timezone,
    utcStart: draft.utcStart,
    utcEnd: draft.utcEnd,
    lines: draft.lines,
    basis: draft.basis,
    sourceStatus: draft.sourceStatus,
    sourceSystem: draft.sourceSystem ?? IMPORT_SOURCE,
    statusMappingId: mapping?.id ?? null,
    certifiedEligible: isReleasedStatus(
      draft.sourceStatus,
      mapping?.statuses ?? null,
    ),
    approvedAtSource: draft.approvedAtSource,
    evidenceRef: draft.evidenceRef,
    sourceFigures: draft.sourceFigures ?? null,
    connectionId: draft.connectionId ?? null,
    importedAt: new Date(),
    importedBy: importer.userId,
    createdBy: importer.userId,
  };
}

/** Lines in one key order (jsonb does not keep the delivered order). */
function canonicalLines(lines: readonly ExternalReportLine[]): string {
  return JSON.stringify(
    lines.map((l) => [l.unitId, l.productId, l.gross, l.good, l.reject, l.uom]),
  );
}

const FIGURE_KEYS = [
  'planned',
  'actual',
  'shortfall',
  'uom',
  'status',
  'quality',
  'plant',
  'eventType',
  'topic',
] as const;

/** Source figures in one key order, absent = null (jsonb does not keep the delivered key order). */
function canonicalFigures(
  figures: ExternalReportSourceFigures | null | undefined,
): string {
  if (!figures) return 'null';
  return JSON.stringify(FIGURE_KEYS.map((key) => figures[key] ?? null));
}

/** Same id + revision: identical content is a duplicate; anything else is a conflicting redelivery. */
function duplicateOf(
  stored: ExternalProductionReport,
  draft: ExternalReportDraft,
): StoreOutcome {
  const same =
    canonicalLines(stored.lines) === canonicalLines(draft.lines) &&
    stored.basis === draft.basis &&
    stored.sourceStatus === draft.sourceStatus &&
    stored.utcStart.getTime() === draft.utcStart.getTime() &&
    stored.utcEnd.getTime() === draft.utcEnd.getTime() &&
    canonicalFigures(stored.sourceFigures) ===
      canonicalFigures(draft.sourceFigures);
  if (same) return 'duplicate';
  throw new ConflictException({
    code: 'REPORT_REVISION_CONFLICT',
    message:
      'this report revision was already imported with different content; send a new revision',
  });
}
