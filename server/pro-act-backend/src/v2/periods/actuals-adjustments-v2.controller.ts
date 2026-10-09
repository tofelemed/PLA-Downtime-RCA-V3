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
import { ActualsAdjustmentsService } from '../../periods/actuals-adjustments.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  AdjustmentApproveDto,
  AdjustmentCreateDto,
  AdjustmentRejectDto,
} from './period-v2.dto';
import { ADJUSTMENT_APPROVERS, PERIOD_WRITERS } from './period-roles';
import { AdjustmentV2View, toAdjustmentView } from './period-v2.view';

/** Governed manual actuals (plan 2.4 step 3, ACT06). */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'actuals/adjustments', version: '2' })
export class ActualsAdjustmentsV2Controller {
  constructor(private readonly adjustments: ActualsAdjustmentsService) {}

  @Post()
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary:
      'Propose an actuals adjustment of a period slice (reason and evidence required)',
    description:
      'Requires `Idempotency-Key`. The slice must be active and of a unit in the caller’s scope (422 ' +
      'INVALID_REFERENCE; 422 SLICE_SUPERSEDED); the measurement window lies inside the slice (422 INVALID_RANGE).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: AdjustmentCreateDto,
  ): Promise<AdjustmentV2View> {
    return toAdjustmentView(await this.adjustments.propose(ctx, body));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One adjustment; foreign or out-of-scope ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdjustmentV2View> {
    return toAdjustmentView(await this.adjustments.get(ctx, id));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...ADJUSTMENT_APPROVERS)
  @ApiOperation({
    summary:
      'Approve a proposed adjustment (independent approver); the period is recalculated',
    description:
      'Requires `Idempotency-Key`. 403 SEPARATION_OF_DUTIES for the author; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentApproveDto,
  ): Promise<AdjustmentV2View> {
    return toAdjustmentView(
      await this.adjustments.approve(ctx, id, body.reason),
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...ADJUSTMENT_APPROVERS)
  @ApiOperation({
    summary:
      'Reject a proposed adjustment with a reason (independent approver)',
    description:
      'Requires `Idempotency-Key`. 403 SEPARATION_OF_DUTIES for the author; 409 INVALID_TRANSITION when not proposed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustmentRejectDto,
  ): Promise<AdjustmentV2View> {
    return toAdjustmentView(
      await this.adjustments.reject(ctx, id, body.reason),
    );
  }
}
