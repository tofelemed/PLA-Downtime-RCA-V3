import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  DerivedStopPreviewQueryDto,
  StopEventPolicyCreateDto,
  StopEventPolicyQueryDto,
} from './stop-events-v2.dto';
import {
  DerivedStopPreviewV2View,
  StopEventPolicyV2Service,
  StopEventPolicyV2View,
} from './stop-event-policy-v2.service';

/** Plan 1.10 / DT-04 / SME D5 stop-event settings (part of `oee_policy`) and the derived-stop preview. */
@ApiTags('v2 · Stop events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class StopEventPolicyV2Controller {
  constructor(private readonly service: StopEventPolicyV2Service) {}

  @Get('stop-event-policies/current')
  @ApiOperation({
    summary:
      'Stop-event settings in force now (unit override, else tenant-wide)',
    description:
      'Fields a version does not state are the pilot defaults: derive from state on, debounce 5 s, restart ' +
      'confirmation 10 s, duplicate tolerance 120 s, automatic merge on, incident window 120 s.',
  })
  current(
    @Ctx() ctx: RequestContext,
    @Query() query: StopEventPolicyQueryDto,
  ): Promise<StopEventPolicyV2View> {
    return this.service.current(ctx, query.unitId);
  }

  @Post('stop-event-policies')
  @Idempotent()
  @Roles('manager_approver')
  @ApiOperation({
    summary:
      'Record new stop-event settings as an approved oee_policy version, effective now (or from a past effectiveFrom while commissioning)',
    description:
      'Requires `Idempotency-Key`. Stated fields replace those in force; other oee_policy fields are kept. ' +
      'Tenant-wide needs a tenant-wide grant (403 TENANT_SCOPE_REQUIRED). Already derived / merged / grouped ' +
      'stops keep their state; the new values apply from now on (a commissioning backdate makes the version the one in ' +
      'force from effectiveFrom for later resolution and recalculation; it does not re-derive stops by itself).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: StopEventPolicyCreateDto,
  ): Promise<StopEventPolicyV2View> {
    return this.service.create(ctx, body);
  }

  @Get('derived-stops/preview')
  @ApiOperation({
    summary:
      'Stops the state engine would derive for a unit and window (nothing is written)',
    description:
      'Plan 1.10 rule preview from the unit’s state mapping and the settings in force at `to`: stops and reduced-rate ' +
      'slowdowns (analog thresholds with hysteresis). Unknown time is ' +
      'never a stop. Window ≤ 7 days (422 INVALID_RANGE).',
  })
  preview(
    @Ctx() ctx: RequestContext,
    @Query() query: DerivedStopPreviewQueryDto,
  ): Promise<DerivedStopPreviewV2View> {
    return this.service.preview(ctx, query);
  }
}
