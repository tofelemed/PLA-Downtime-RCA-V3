import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { listResponse, ListResponse } from '../v2/common/response';
import { CodeLibraryKind, FailureGroupKind } from './code-library-kind';
import { CODE_LIBRARY_DESCRIPTORS, CodeRow } from './code-library.descriptors';
import { CodeVersion } from './code-version.entity';
import { CodeV2View, toCodeView } from './code-view';

export interface CodeListQuery {
  cursor?: string;
  limit: number;
  sort?: string;
  parentId?: string;
  rootsOnly?: boolean;
  asOf?: string;
  includeRetired?: boolean;
  groupKind?: FailureGroupKind;
}

const VERSION_LIST_CAP = 500;

/**
 * Reads of the code libraries (plan 1.3): tenant-scoped (NFR01, no shared codes), tree filters
 * (`parentId`, `rootsOnly`), validity (`asOf`, or active now unless `includeRetired`), keyset pages on
 * (code, id).
 */
@Injectable()
export class CodeLibraryService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(
    context: RequestContext,
    library: CodeLibraryKind,
    query: CodeListQuery,
  ): Promise<ListResponse<CodeV2View>> {
    assertQueryFits(library, query);
    const descending = query.sort === '-code';
    const qb = this.scoped(context, library);
    applyFilters(qb, query);
    applyCursor(qb, query.cursor, descending);
    const direction = descending ? 'DESC' : 'ASC';
    qb.orderBy('code.code', direction)
      .addOrderBy('code.id', direction)
      .take(query.limit + 1);
    const rows = await qb.getMany();
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({ sortValue: last.code, id: last.id })
        : null;
    const now = new Date();
    return listResponse(
      page.map((row) => toCodeView(library, row, now)),
      nextCursor,
      { tenantId: requireTenantId(context) },
      now,
    );
  }

  async get(
    context: RequestContext,
    library: CodeLibraryKind,
    id: string,
  ): Promise<CodeV2View> {
    return toCodeView(library, await this.find(context, library, id));
  }

  /** The row of the caller's tenant; 404 for unknown or foreign ids. */
  async find(
    context: RequestContext,
    library: CodeLibraryKind,
    id: string,
    manager: EntityManager = this.manager,
  ): Promise<CodeRow> {
    const row = await this.scoped(context, library, manager)
      .andWhere('code.id = :id', { id })
      .getOne();
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    return row;
  }

  /** Version history of a code, oldest first (capped at 500 rows). */
  async versions(
    context: RequestContext,
    library: CodeLibraryKind,
    id: string,
  ): Promise<CodeVersion[]> {
    await this.find(context, library, id);
    return scopedQuery(this.manager.getRepository(CodeVersion), 'cv', {
      context,
    })
      .andWhere('cv.library = :library AND cv.codeId = :id', { library, id })
      .orderBy('cv.version', 'ASC')
      .take(VERSION_LIST_CAP)
      .getMany();
  }

  scoped(
    context: RequestContext,
    library: CodeLibraryKind,
    manager: EntityManager = this.manager,
  ): SelectQueryBuilder<CodeRow> {
    const repository = manager.getRepository<CodeRow>(
      CODE_LIBRARY_DESCRIPTORS[library].entity,
    );
    return scopedQuery(repository, 'code', { context });
  }
}

/** Tree filters need a hierarchical library; `groupKind` exists on failure groups only (422 otherwise). */
function assertQueryFits(library: CodeLibraryKind, query: CodeListQuery): void {
  const { hierarchical } = CODE_LIBRARY_DESCRIPTORS[library];
  const field =
    !hierarchical && (query.parentId || query.rootsOnly)
      ? query.parentId
        ? 'parentId'
        : 'rootsOnly'
      : library !== 'failure' && query.groupKind
        ? 'groupKind'
        : null;
  if (field) throw fieldNotAllowed(library, field);
}

export function fieldNotAllowed(
  library: CodeLibraryKind,
  field: string,
): UnprocessableEntityException {
  const message = `${field} is not supported by the ${library} library`;
  return new UnprocessableEntityException({
    code: 'FIELD_NOT_ALLOWED',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

function applyFilters(
  qb: SelectQueryBuilder<CodeRow>,
  query: CodeListQuery,
): void {
  if (query.parentId) {
    qb.andWhere('code.parentId = :parentId', { parentId: query.parentId });
  } else if (query.rootsOnly) {
    qb.andWhere('code.parentId IS NULL');
  }
  if (query.groupKind) {
    qb.andWhere('code.groupKind = :groupKind', { groupKind: query.groupKind });
  }
  if (query.asOf) {
    qb.andWhere('(code.effectiveFrom IS NULL OR code.effectiveFrom <= :asOf)', {
      asOf: query.asOf,
    }).andWhere('(code.effectiveTo IS NULL OR code.effectiveTo > :asOf)');
  } else if (!query.includeRetired) {
    qb.andWhere('code.isActive = true').andWhere(
      '(code.effectiveTo IS NULL OR code.effectiveTo > now())',
    );
  }
}

function applyCursor(
  qb: SelectQueryBuilder<CodeRow>,
  cursor: string | undefined,
  descending: boolean,
): void {
  if (!cursor) return;
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'string') throw invalidCursor();
  const op = descending ? '<' : '>';
  qb.andWhere(
    `(code.code ${op} :cursorCode OR (code.code = :cursorCode AND code.id ${op} :cursorId))`,
    { cursorCode: sortValue, cursorId: id },
  );
}
