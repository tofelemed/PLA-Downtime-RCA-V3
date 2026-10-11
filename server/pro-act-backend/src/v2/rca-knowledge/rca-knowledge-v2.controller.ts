import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { RcaKnowledgeSimilarService } from '../../rca-knowledge-base/knowledge-similar.service';
import { RcaKnowledgeV2CommandsService } from '../../rca-knowledge-base/knowledge-v2-commands.service';
import { RcaKnowledgeV2Service } from '../../rca-knowledge-base/knowledge-v2.service';
import {
  RcaKnowledgeSimilarV2View,
  RcaKnowledgeV2View,
} from '../../rca-knowledge-base/knowledge-v2.view';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RcaKnowledgeListQueryDto,
  RcaKnowledgeSimilarQueryDto,
  RcaKnowledgeVoteDto,
} from './rca-knowledge-v2.dto';

const QUALITY =
  'qualityScore (0–100) is computed on the server: root cause 30, problem statement 15, a recommendation 10, ' +
  'a tracked action 10, share of non-cancelled actions done × 10, unit or asset 10, linked case 5, ' +
  'helpful share of votes × 10 (0 without votes); `quality` lists the parts.';
const PUBLISHERS =
  'Reliability engineer or manager approver (unit-limited grants: entries of their units). Requires ' +
  '`Idempotency-Key` and `If-Match` (428/412); asking for the current state changes nothing.';

/**
 * RCA knowledge base (owner decision 2026-10-12): entries written when RCA cases close, searched and
 * paged on the server, with votes, publish control and similar past cases of an event.
 */
@ApiTags('v2 · RCA knowledge')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rca-knowledge', version: '2' })
export class RcaKnowledgeV2Controller {
  constructor(
    private readonly entries: RcaKnowledgeV2Service,
    private readonly commands: RcaKnowledgeV2CommandsService,
    private readonly similarCases: RcaKnowledgeSimilarService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search knowledge entries of your scope (newest first)',
    description:
      'Filters: q (title, root cause, problem, description), unit, asset (entry or a linked event), reason code ' +
      `of a linked event, published, created from/to (half-open). ${QUALITY}`,
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaKnowledgeListQueryDto,
  ): Promise<ListResponse<RcaKnowledgeV2View>> {
    return this.entries.list(ctx, query);
  }

  @Get('similar')
  @ApiOperation({
    summary:
      'Similar past RCAs of an event (asset 3 + reason 2 + unit 1, then published, then newest)',
    description:
      'Entries whose case is already linked to the event are left out. Foreign or out-of-scope events are 404.',
  })
  similar(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaKnowledgeSimilarQueryDto,
  ): Promise<RcaKnowledgeSimilarV2View[]> {
    return this.similarCases.similar(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One entry (ETag = rowVersion); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaKnowledgeV2View> {
    return this.entries.get(ctx, id);
  }

  @Post(':id/votes')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Vote helpful or not helpful (one vote per user; a repeat replaces it)',
    description:
      'Requires `Idempotency-Key`. Any member who may write; read-only roles are refused.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  vote(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RcaKnowledgeVoteDto,
  ): Promise<RcaKnowledgeV2View> {
    return this.commands.vote(ctx, id, body.helpful);
  }

  @Post(':id/publish')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Publish an entry', description: PUBLISHERS })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  publish(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<RcaKnowledgeV2View> {
    return this.commands.setPublished(ctx, { id, expectedRowVersion }, true);
  }

  @Post(':id/unpublish')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Withdraw a published entry',
    description: PUBLISHERS,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  unpublish(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<RcaKnowledgeV2View> {
    return this.commands.setPublished(ctx, { id, expectedRowVersion }, false);
  }
}
