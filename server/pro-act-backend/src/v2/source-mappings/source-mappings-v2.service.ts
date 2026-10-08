import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Asset } from '../../asset/asset.entity';
import { assertRevision } from '../../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { normalizeMatchValue } from '../../source-mapping/mapping-rule';
import { SourceMapping } from '../../source-mapping/source-mapping.entity';
import { SourceMappingService } from '../../source-mapping/source-mapping.service';
import { Unit } from '../../unit/unit.entity';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { listResponse, ListResponse } from '../common/response';
import {
  SourceMappingListQueryDto,
  SourceMappingPreviewDto,
  SourceMappingV2WriteDto,
} from './source-mapping-v2.dto';
import {
  MappingPreviewView,
  SourceMappingV2View,
  toPreviewResult,
  toSourceMappingView,
} from './source-mapping-v2.view';

const UNIQUE_VIOLATION = '23505';

/** v2 source mappings (plan 1.3, ING03): tenant-scoped CRUD with typed targets and a resolution preview. */
@Injectable()
export class SourceMappingsV2Service {
  constructor(
    @InjectRepository(SourceMapping)
    private readonly mappings: Repository<SourceMapping>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    private readonly resolution: SourceMappingService,
  ) {}

  async list(
    context: RequestContext,
    query: SourceMappingListQueryDto,
  ): Promise<ListResponse<SourceMappingV2View>> {
    const qb = scopedQuery(this.mappings, 'sm', { context });
    if (query.matchKind)
      qb.andWhere('sm.matchKind = :matchKind', { matchKind: query.matchKind });
    if (query.targetId)
      qb.andWhere('sm.targetId = :targetId', { targetId: query.targetId });
    if (!query.includeInactive) qb.andWhere('sm.isActive = true');
    if (query.cursor) {
      const { sortValue, id } = CursorCodec.decode(query.cursor);
      if (typeof sortValue !== 'string') throw invalidCursor();
      qb.andWhere(
        '(sm.createdAt > :at OR (sm.createdAt = :at AND sm.id > :id))',
        {
          at: new Date(sortValue),
          id,
        },
      );
    }
    qb.orderBy('sm.createdAt', 'ASC')
      .addOrderBy('sm.id', 'ASC')
      .take(query.limit + 1);
    const rows = await qb.getMany();
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({
            sortValue: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;
    return listResponse(page.map(toSourceMappingView), nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  async get(context: RequestContext, id: string): Promise<SourceMappingV2View> {
    return toSourceMappingView(await this.find(context, id));
  }

  async create(
    context: RequestContext,
    dto: SourceMappingV2WriteDto,
  ): Promise<SourceMappingV2View> {
    const tenantId = requireTenantId(context);
    await this.assertTarget(tenantId, dto);
    const row = this.mappings.create({
      ...columnsOf(dto),
      tenantId,
      version: 1,
      legacyMappingId: null,
      createdBy: context.userId,
      updatedBy: context.userId,
    });
    return toSourceMappingView(await this.saveUnique(row));
  }

  /** PUT replaces the rule (`If-Match` on rowVersion); `version` counts the edits. */
  async replace(
    context: RequestContext,
    target: { id: string; expectedRevision: number },
    dto: SourceMappingV2WriteDto,
  ): Promise<SourceMappingV2View> {
    const existing = await this.find(context, target.id);
    assertRevision(existing.rowVersion, target.expectedRevision);
    if (existing.legacyMappingId) {
      throw new ConflictException({
        code: 'LEGACY_MAPPING',
        message:
          'This rule mirrors a v1 hierarchy mapping; edit it through /api/hierarchy-mappings until plan 3.10',
      });
    }
    await this.assertTarget(existing.tenantId, dto);
    Object.assign(existing, columnsOf(dto), {
      version: existing.version + 1,
      updatedBy: context.userId,
    });
    return toSourceMappingView(await this.saveUnique(existing));
  }

  async preview(
    context: RequestContext,
    dto: SourceMappingPreviewDto,
  ): Promise<MappingPreviewView> {
    const resolver = await this.resolution.loadResolver(
      requireTenantId(context),
      dto.connectionId ?? null,
    );
    const results = dto.samples.map((sample) =>
      toPreviewResult(sample, resolver.resolve(sample)),
    );
    const summary = { mapped: 0, ambiguous: 0, invalid_target: 0, unmapped: 0 };
    for (const result of results) summary[result.status] += 1;
    return { results, summary };
  }

  private async find(
    context: RequestContext,
    id: string,
  ): Promise<SourceMapping> {
    const row = await scopedQuery(this.mappings, 'sm', { context })
      .andWhere('sm.id = :id', { id })
      .getOne();
    if (!row)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    return row;
  }

  /** 422 INVALID_REFERENCE unless the target unit/asset belongs to the tenant (no existence leak). */
  private async assertTarget(
    tenantId: string,
    dto: SourceMappingV2WriteDto,
  ): Promise<void> {
    assertInterval(dto);
    const owned =
      dto.targetType === 'unit'
        ? await this.units.existsBy({ id: dto.targetId, tenantId })
        : await this.assets.existsBy({ id: dto.targetId, tenantId });
    if (!owned) {
      const message = `targetId is not a ${dto.targetType} of this tenant`;
      throw new UnprocessableEntityException({
        code: 'INVALID_REFERENCE',
        message: [message],
        fieldErrors: [{ field: 'targetId', message }],
      });
    }
  }

  private async saveUnique(row: SourceMapping): Promise<SourceMapping> {
    try {
      return await this.mappings.save(row);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        throw new ConflictException({
          code: 'MAPPING_EXISTS',
          message:
            'An active rule with the same kind and value already exists for this connection',
        });
      }
      throw error;
    }
  }
}

function assertInterval(dto: SourceMappingV2WriteDto): void {
  if (
    dto.effectiveFrom &&
    dto.effectiveTo &&
    new Date(dto.effectiveTo) <= new Date(dto.effectiveFrom)
  ) {
    const message = 'effectiveTo must be later than effectiveFrom';
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: [message],
      fieldErrors: [{ field: 'effectiveTo', message }],
    });
  }
}

function columnsOf(dto: SourceMappingV2WriteDto): Partial<SourceMapping> {
  return {
    matchKind: dto.matchKind,
    matchValue: dto.matchValue,
    normalizedValue: normalizeMatchValue(dto.matchKind, dto.matchValue),
    targetType: dto.targetType,
    targetId: dto.targetId,
    precedence: dto.precedence ?? 0,
    connectionId: dto.connectionId ?? null,
    sourceSystem: dto.sourceSystem ?? 'PI',
    effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
    effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
    isActive: dto.isActive ?? true,
    description: dto.description ?? null,
  };
}
