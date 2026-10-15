import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ChangeProposalsService } from '../../reconciliation/change-proposals.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  CORRECTION_PROPOSERS,
  REVISION_APPROVERS,
} from '../periods/period-roles';
import {
  ManualProposalDto,
  ProposalDecisionDto,
} from './reconciliation-v2.dto';
import { ReconciliationV2Service } from './reconciliation-v2.service';
import {
  ChangeProposalV2View,
  ReconciliationV2View,
} from './reconciliation-v2.view';

export interface ProposalDecisionV2View {
  proposal: ChangeProposalV2View;
  /** the revise draft an acceptance opened (null when dismissed) */
  revision: ReconciliationV2View | null;
}

/** Change proposals of approved periods (plan 2.8, WF04): propose (manual, SME R4), read, accept (→ revise draft), dismiss. */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'period-change-proposals', version: '2' })
export class ChangeProposalsV2Controller {
  constructor(
    private readonly reads: ReconciliationV2Service,
    private readonly proposals: ChangeProposalsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Roles(...CORRECTION_PROPOSERS)
  @ApiOperation({
    summary:
      'Propose a correction of an approved period of a closing or locked month (manual change proposal)',
    description:
      'Requires `Idempotency-Key`. Reason and evidence required; the proposer never decides it (403 SEPARATION_OF_DUTIES). ' +
      '409 MONTH_OPEN (revise directly), PROPOSAL_OPEN, REVISION_MISMATCH, REVISION_OPEN; 404 out of scope.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async propose(
    @Ctx() ctx: RequestContext,
    @Body() body: ManualProposalDto,
  ): Promise<ChangeProposalV2View> {
    const created = await this.proposals.propose(ctx, body);
    return this.reads.proposal(ctx, created.id);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One change proposal; foreign or out-of-scope ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ChangeProposalV2View> {
    return this.reads.proposal(ctx, id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @ApiOperation({
    summary:
      'Accept an open proposal: a revise draft over the approved revision (never an edit of approved figures)',
    description:
      'Requires `Idempotency-Key`. 409 INVALID_TRANSITION unless open; 409 REVISION_OPEN / REVISION_MISMATCH as revise.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async accept(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProposalDecisionDto,
  ): Promise<ProposalDecisionV2View> {
    const decision = await this.proposals.accept(ctx, id, body.reason);
    return {
      proposal: await this.reads.proposal(ctx, decision.proposal.id),
      revision: decision.revision
        ? await this.reads.viewOf(ctx, decision.revision)
        : null,
    };
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...REVISION_APPROVERS)
  @ApiOperation({
    summary:
      'Dismiss an open proposal with a reason (the approved revision stays as it is)',
    description:
      'Requires `Idempotency-Key`. 409 INVALID_TRANSITION unless open.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async dismiss(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProposalDecisionDto,
  ): Promise<ProposalDecisionV2View> {
    const decision = await this.proposals.dismiss(ctx, id, body.reason);
    return {
      proposal: await this.reads.proposal(ctx, decision.proposal.id),
      revision: null,
    };
  }
}
