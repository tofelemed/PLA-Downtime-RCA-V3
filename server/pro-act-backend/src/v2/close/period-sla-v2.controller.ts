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
import {
  PeriodSlaService,
  PeriodSlaSnapshot,
} from '../../close/period-sla.service';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PERIOD_WRITERS } from '../periods/period-roles';
import { OpenDataHoldDto, ReleaseDataHoldDto } from './period-sla-v2.dto';
import {
  PeriodSlaDetailV2View,
  toPeriodSlaDetailView,
} from './period-sla-detail.view';

const IDEMPOTENT = 'Requires `Idempotency-Key`. ';

/**
 * Reconciliation SLA of a period (SME R3 / R6, phase R-C): due times, overdue and escalation computed on
 * the server, the "waiting for data" holds that pause the clocks, and the latest rejection.
 */
@ApiTags('v2 · Reconciliation SLA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-periods', version: '2' })
export class PeriodSlaV2Controller {
  constructor(private readonly slas: PeriodSlaService) {}

  @Get(':id/sla')
  @ApiOperation({
    summary:
      'Due times (submit, approve), overdue, age without waits, escalation level and role, rejections, holds and the latest rejection',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PeriodSlaDetailV2View> {
    return this.view(await this.slas.snapshot(ctx, id));
  }

  @Post(':id/data-holds')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary:
      'The period waits for data (lab, source, other): the SLA clocks pause',
    description:
      IDEMPOTENT +
      '409 HOLD_OPEN when it already waits, PERIOD_APPROVED for an approved period (a late value goes through ' +
      'a change proposal).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async open(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OpenDataHoldDto,
  ): Promise<PeriodSlaDetailV2View> {
    return this.view(await this.slas.openHold(ctx, id, body));
  }

  @Post(':id/data-holds/release')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary: 'The data arrived: the hold ends and the clocks run again',
    description: IDEMPOTENT + '409 NO_OPEN_HOLD.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async release(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReleaseDataHoldDto,
  ): Promise<PeriodSlaDetailV2View> {
    return this.view(await this.slas.releaseHold(ctx, id, body.note ?? null));
  }

  private view(snapshot: PeriodSlaSnapshot): PeriodSlaDetailV2View {
    return toPeriodSlaDetailView(snapshot);
  }
}
