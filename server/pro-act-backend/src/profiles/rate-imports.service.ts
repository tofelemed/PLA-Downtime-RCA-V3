import { assertTenantWideWriter } from './profile-scope';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { RateImportKind } from '../domain/profiles/profile.types';
import { ImportRowInput } from '../domain/profiles/rate-import-rows';
import { RateImport } from './entities/rate-import.entity';
import { invalid, notFound } from './profile-errors';

export interface RateImportRequest {
  kind: RateImportKind;
  externalId: string;
  fileRef?: string;
  rows?: ImportRowInput[];
  csv?: string;
}

/**
 * Budget / forecast / MPC deliveries (plan 2.2 step 4, PLAN06): the request stores the document as the
 * next revision of its external id and queues it (202); `RateImportRunner` validates and applies it in
 * the worker. Revisions are corrections of the document, never additions.
 */
@Injectable()
export class RateImportsService {
  constructor(
    @InjectRepository(RateImport)
    private readonly imports: Repository<RateImport>,
  ) {}

  async request(
    context: RequestContext,
    input: RateImportRequest,
  ): Promise<RateImport> {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    if (Boolean(input.rows) === Boolean(input.csv)) {
      throw invalid('INVALID_IMPORT', 'send either rows or csv');
    }
    const externalId = input.externalId.trim();
    return this.imports.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `rate_imports:${tenantId}:${input.kind}:${externalId}`,
      ]);
      const revision = await nextRevision(
        manager,
        tenantId,
        input.kind,
        externalId,
      );
      return manager.save(
        manager.create(RateImport, {
          tenantId,
          kind: input.kind,
          externalId,
          revision,
          fileRef: input.fileRef?.trim() || null,
          state: 'queued',
          payload: input.rows ? { rows: input.rows } : { csv: input.csv },
          importedBy: context.userId,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  async get(context: RequestContext, id: string): Promise<RateImport> {
    const found = await scopedQuery(this.imports, 'i', { context })
      .andWhere('i.id = :id', { id })
      .getOne();
    if (!found) throw notFound('Rate import');
    return found;
  }
}

/** Next revision of a document (1 for the first delivery), under the caller's document lock. */
async function nextRevision(
  manager: EntityManager,
  tenantId: string,
  kind: RateImportKind,
  externalId: string,
): Promise<number> {
  const row = await manager
    .createQueryBuilder(RateImport, 'i')
    .select('COALESCE(MAX(i.revision), 0)', 'max')
    .where(
      'i.tenantId = :tenantId AND i.kind = :kind AND i.externalId = :externalId',
      {
        tenantId,
        kind,
        externalId,
      },
    )
    .getRawOne<{ max: number | string }>();
  return Number(row?.max ?? 0) + 1;
}
