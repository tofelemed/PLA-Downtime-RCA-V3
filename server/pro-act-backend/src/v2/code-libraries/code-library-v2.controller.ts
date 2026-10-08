import {
  Body,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CodeLibraryKind } from '../../code-library/code-library-kind';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { CodeSnapshot } from '../../code-library/code-version.entity';
import { CodeV2View } from '../../code-library/code-view';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../common/response';
import {
  CodeV2ChangeDto,
  CodeV2CreateDto,
  CodeV2ListQueryDto,
  CodeV2RetireDto,
} from './code-v2.dto';

/** Writers of master data (engineering default, DECISIONS.md §D 2026-10-08). */
export const CODE_WRITERS = ['master_data_admin', 'manager_approver'] as const;

export interface CodeVersionV2View {
  version: number;
  code: string;
  name: string;
  parentId: string | null;
  snapshot: CodeSnapshot;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
}

/**
 * Shared routes of every code library (plan 1.3, spec §3.2, T18); each library is a subclass with its
 * own path and tag. Codes are per tenant (NFR01); hierarchical libraries keep an acyclic tree; a change is
 * a new version (`If-Match` on the current version); retire never deletes.
 */
export abstract class CodeLibraryV2Controller {
  protected abstract readonly library: CodeLibraryKind;

  constructor(
    protected readonly reads: CodeLibraryService,
    protected readonly commands: CodeLibraryCommandService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List codes of the caller tenant',
    description:
      'Tree filters `parentId` (direct children) and `rootsOnly`; `asOf` returns the codes valid at that ' +
      'instant, otherwise active codes unless `includeRetired`. Keyset pages on (code, id).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: CodeV2ListQueryDto,
  ): Promise<ListResponse<CodeV2View>> {
    return this.reads.list(ctx, this.library, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one code (ETag = current version); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CodeV2View> {
    return this.reads.get(ctx, this.library, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Version history of a code, oldest first' })
  async versions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CodeVersionV2View[]> {
    const rows = await this.reads.versions(ctx, this.library, id);
    return rows.map((row) => ({
      version: row.version,
      code: row.code,
      name: row.name,
      parentId: row.parentId,
      snapshot: row.snapshot,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      createdBy: row.createdBy,
    }));
  }

  @Post()
  @Idempotent()
  @Roles(...CODE_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a code (version 1)',
    description:
      'Requires `Idempotency-Key`. 409 CODE_EXISTS for a duplicate code in the tenant; 422 INVALID_REFERENCE ' +
      'for a parent outside the library/tenant or a retired parent; 422 FIELD_NOT_ALLOWED for fields of ' +
      'another library.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CodeV2CreateDto,
  ): Promise<CodeV2View> {
    return this.commands.create(ctx, this.library, body);
  }

  @Put(':id')
  @Roles(...CODE_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change a code: records the next version',
    description:
      'Requires `If-Match: "<version>"` (428/412). A new parent re-paths the subtree; a parent inside the ' +
      "code's own subtree is 422 CODE_CYCLE. Retired codes are 409 CODE_RETIRED.",
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: CodeV2ChangeDto,
  ): Promise<CodeV2View> {
    return this.commands.update(
      ctx,
      this.library,
      { id, expectedVersion },
      body,
    );
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...CODE_WRITERS)
  @ApiOperation({
    summary: 'Retire a code (end of validity; history and references stay)',
    description:
      'Requires `Idempotency-Key`. 409 CODE_HAS_CHILDREN with `details.references` ' +
      '(activeChildren, events, mappingRules) while active child codes exist; 409 CODE_RETIRED when already retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CodeV2RetireDto,
  ): Promise<CodeV2View> {
    return this.commands.retire(ctx, this.library, id, body.effectiveTo);
  }
}
