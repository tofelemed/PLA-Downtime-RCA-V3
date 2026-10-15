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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { LotDispositionsService } from '../../quality-dispositions/lot-dispositions.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  AdjustmentApproveDto,
  AdjustmentRejectDto,
} from '../periods/period-v2.dto';
import {
  DISPOSITION_APPROVERS,
  DISPOSITION_WRITERS,
} from './disposition-roles';
import {
  LotDispositionCreateDto,
  LotDispositionListQueryDto,
} from './lot-disposition-v2.dto';
import {
  LotDispositionV2View,
  toLotDispositionView,
} from './lot-disposition-v2.view';
import { LotDispositionsV2Service } from './lot-dispositions-v2.service';

/**
 * Lot dispositions and recovery movements (SME E3): which part of a lot is intentional wide-spec,
 * downgraded, transition off-grade, scrapped or sent to rework, and which reprocessed quantity came
 * back as saleable output. Approved rows classify the period actuals of the lot's production interval.
 */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'lot-dispositions', version: '2' })
export class LotDispositionsV2Controller {
  constructor(
    private readonly lists: LotDispositionsV2Service,
    private readonly dispositions: LotDispositionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List lot dispositions (production interval overlapping [from, to); keyset on productionStart, id, newest first)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: LotDispositionListQueryDto,
  ): Promise<ListResponse<LotDispositionV2View>> {
    return this.lists.list(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...DISPOSITION_WRITERS)
  @ApiOperation({
    summary: 'Propose a lot disposition or recovery movement',
    description:
      'Requires `Idempotency-Key`. 422 INVALID_REFERENCE (unit, product, event or linked disposition outside the ' +
      'caller’s scope), INVALID_QUANTITY, INVALID_RANGE (empty or future interval), INVALID_RECOVERY, ' +
      'NOT_RECOVERABLE, UOM_MISMATCH, RECOVERY_EXCEEDS_DISPOSITION, INVALID_SUPERSEDE.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: LotDispositionCreateDto,
  ): Promise<LotDispositionV2View> {
    return toLotDispositionView(await this.dispositions.propose(ctx, body));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One lot disposition; foreign or out-of-scope ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<LotDispositionV2View> {
    return toLotDispositionView(await this.dispositions.get(ctx, id));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...DISPOSITION_APPROVERS)
  @ApiOperation({
    summary:
      'Approve a proposed disposition (Quality / Lab approver, never the author); the periods of its production interval are recalculated',
    description:
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE unless a quality_approver; 403 SEPARATION_OF_DUTIES for the author; 409 INVALID_TRANSITION when not ' +
      'proposed; 422 RECOVERY_EXCEEDS_DISPOSITION / INVALID_SUPERSEDE when the linked disposition changed since.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentApproveDto,
  ): Promise<LotDispositionV2View> {
    return toLotDispositionView(
      await this.dispositions.approve(ctx, id, body.reason),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...DISPOSITION_APPROVERS)
  @ApiOperation({
    summary:
      'Reject a proposed disposition with a reason (Quality / Lab approver, never the author)',
    description:
      'Requires `Idempotency-Key`. 403 FORBIDDEN_ROLE unless a quality_approver; 403 SEPARATION_OF_DUTIES for the author; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentRejectDto,
  ): Promise<LotDispositionV2View> {
    return toLotDispositionView(
      await this.dispositions.reject(ctx, id, body.reason),
    );
  }
}
