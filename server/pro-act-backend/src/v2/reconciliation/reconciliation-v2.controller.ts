import { MoneyFields } from '../../auth/money/money.decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { ApprovalService } from '../../reconciliation/approval.service';
import { BridgeReviewService } from '../../reconciliation/bridge-review.service';
import { DraftLinesService } from '../../reconciliation/draft-lines.service';
import { RevisionLifecycleService } from '../../reconciliation/revision-lifecycle.service';
import { SubmissionService } from '../../reconciliation/submission.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PERIOD_WRITERS, REVISION_APPROVERS } from '../periods/period-roles';
import {
  ApproveRevisionDto,
  DraftLinesDto,
  ReasonedRevisionDto,
  ReconciliationQueryDto,
  RejectRevisionDto,
  ReviseRevisionDto,
  SubmitRevisionDto,
  WorkflowListQueryDto,
  ChangeProposalListQueryDto,
} from './reconciliation-v2.dto';
import { ReconciliationV2Service } from './reconciliation-v2.service';
import {
  ApprovalActionV2View,
  ChangeProposalV2View,
  ReconciliationV2View,
} from './reconciliation-v2.view';
import { ReversibleLineV2View } from './reversible-lines';

const IDEMPOTENT = 'Requires `Idempotency-Key`. ';

/**
 * Reconciliation editor backend and approval workflow of production periods (plan 2.8, §15.2/§15.3,
 * ACC07–ACC10, WF01–WF05). Every command answers the reconciliation view of the revision it touched,
 * with `ETag` = the revision's row version.
 */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-periods', version: '2' })
export class ReconciliationV2Controller {
  constructor(
    private readonly reads: ReconciliationV2Service,
    private readonly drafts: DraftLinesService,
    private readonly submissions: SubmissionService,
    private readonly approvals: ApprovalService,
    private readonly lifecycle: RevisionLifecycleService,
    private readonly bridgeReviews: BridgeReviewService,
  ) {}

  @Get(':id/reconciliation')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Reconciliation of a revision: per-slice target, actual, signed gap, attributed, tolerance adjustment, residual, over-accounted; candidates with decisions; saved lines; content hash',
    description:
      'Default: the open revision, else the published one. ETag = the revision row version (If-Match of draft-lines).',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReconciliationQueryDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.view(ctx, id, query);
  }

  @Put(':id/draft-lines')
  @Roles(...PERIOD_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Replace the full set of decisions and manual lines of the draft atomically (§15.3)',
    description:
      'Requires `If-Match` (428 / 412 STALE_REVISION). 409 RUN_CHANGED with the candidate diff when baseRunId is not ' +
      'the current run; 422 with `details.issues[].line` for invalid lines (INVALID_REFERENCE, UNKNOWN_CANDIDATE, ' +
      'CODE_COMBINATION_INVALID, EVIDENCE_OUTSIDE_SEGMENT, ALLOCATION_EXCEEDED with expectedRemainingAllocation, …).',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async saveDraftLines(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expected: number,
    @Body() body: DraftLinesDto,
  ): Promise<ReconciliationV2View> {
    const revision = await this.drafts.save(ctx, id, expected, body);
    return this.reads.viewOf(ctx, revision);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Submit the draft for approval (gates, tolerance adjustments, submitted hash)',
    description:
      IDEMPOTENT +
      '409 RUN_CHANGED / CONTENT_CHANGED for a stale view; 422 RESIDUAL_UNEXPLAINED, OVER_ACCOUNTED, ' +
      'OVERPRODUCTION_CONFLICT, ACTUALS_INCOMPLETE, SOURCE_CONFLICT, RECALCULATION_PENDING, MISSING_CODE, ' +
      'BASELINE_CHANGED, OPEN_REVIEW_ITEMS; declared mode: DECLARED_LOSS_MISSING, DECLARED_DUPLICATE, DECLARED_IDENTITY_MISMATCH; ' +
      'a block coding gate: CODING_INCOMPLETE with LOSS_EVENT_UNCODED / CODING_COVERAGE_LOW (details.issues lists all).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async submit(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SubmitRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(ctx, await this.submissions.submit(ctx, id, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Approve the submitted revision (snapshot, immutable afterwards)',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      IDEMPOTENT +
      '403 SEPARATION_OF_DUTIES for the submitter (all non-SuperAdmin roles); 409 STALE_SUBMISSION when inputs changed after ' +
      'submission or the hash differs; SME R8: 409 BRIDGE_REVIEW_REQUIRED while a bridge above the unit limit ' +
      'waits for its second review, 403 SEPARATION_OF_DUTIES for the bridge reviewer; declared mode: 409 ' +
      'DECLARED_NOT_CONFIRMED while OT has not confirmed the production loss of the period.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(ctx, await this.approvals.approve(ctx, id, body));
  }

  @Post(':id/bridge-review')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'SME R8: second independent review of the bridges above the unit limit of the submitted revision',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      IDEMPOTENT +
      'By a revision approver independent of the submission (403 SEPARATION_OF_DUTIES); the final approver must ' +
      'be someone else. 409 BRIDGE_REVIEW_NOT_REQUIRED / BRIDGE_ALREADY_REVIEWED / STALE_SUBMISSION.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async bridgeReview(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(
      ctx,
      await this.bridgeReviews.review(ctx, id, body),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Reject the submitted revision back to its preparer with a reason, the failed lines and a new due time',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      IDEMPOTENT +
      '403 SEPARATION_OF_DUTIES for the submitter; 422 INVALID_REFERENCE for a failed line that is not in the ' +
      'reviewed revision. The rejection (history `detail`) carries the new due time from the reconciliation SLA ' +
      'policy and escalates the configured n-th rejection (SME R6: the third) to production accounting.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(ctx, await this.approvals.reject(ctx, id, body));
  }

  @Post(':id/revise')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Open a new draft revision over the published approved one ("Unlock"); the approved revision stays published',
    description:
      IDEMPOTENT +
      '409 REVISION_MISMATCH when approvedRevision is not the published one, REVISION_OPEN when a revision is ' +
      'open. A recalculation is queued for the new draft.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async revise(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviseRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(ctx, await this.lifecycle.revise(ctx, id, body));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Cancel a draft revision (kept and audited)',
    description:
      IDEMPOTENT + '409 INVALID_TRANSITION unless the revision is a draft.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async cancel(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonedRevisionDto,
  ): Promise<ReconciliationV2View> {
    return this.reads.viewOf(ctx, await this.lifecycle.cancel(ctx, id, body));
  }

  @Get(':id/approval-actions')
  @ApiOperation({
    summary:
      'Workflow history of the period’s revisions, newest first (keyset)',
  })
  approvalActions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: WorkflowListQueryDto,
  ): Promise<ListResponse<ApprovalActionV2View>> {
    return this.reads.approvalActions(ctx, id, query);
  }

  @Get(':id/reversible-lines')
  @ApiOperation({
    summary:
      'SME R9: approved lines of the unit’s earlier periods (62 days) a reversal of this period may name, newest first (keyset)',
    description:
      'Lines of the published revision of each earlier period, of the kinds the tolerance policy allows to reverse, ' +
      'with what approved reversals already took back and what is left.',
  })
  reversible(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: WorkflowListQueryDto,
  ): Promise<ListResponse<ReversibleLineV2View>> {
    return this.reads.reversible(ctx, id, query);
  }

  // QA re-test 2026-10-19: a proposal's `before.values` are loss values per currency (left out for operators)
  @MoneyFields('values')
  @Get(':id/change-proposals')
  @ApiOperation({
    summary:
      'Change proposals of the period’s approved revisions (before / after), newest first (keyset)',
  })
  proposals(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ChangeProposalListQueryDto,
  ): Promise<ListResponse<ChangeProposalV2View>> {
    return this.reads.proposals(ctx, id, query);
  }
}
