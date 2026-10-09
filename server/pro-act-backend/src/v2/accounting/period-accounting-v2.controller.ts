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
import { AccountingCommandsService } from '../../accounting/accounting-commands.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { AnalyticsResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PERIOD_WRITERS } from '../periods/period-roles';
import {
  CalculationRunListQueryDto,
  PeriodAccountingQueryDto,
  RecalculatePeriodsDto,
} from './period-accounting-v2.dto';
import { PeriodAccountingV2Service } from './period-accounting-v2.service';
import { PeriodAccountingV2View, RunV2View } from './period-accounting-v2.view';

/** Loss ledgers and calculation runs of production periods (plan 2.5, ACC01–ACC08, FND03). */
@ApiTags('v2 · Loss accounting')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-periods', version: '2' })
export class PeriodAccountingV2Controller {
  constructor(
    private readonly reads: PeriodAccountingV2Service,
    private readonly commands: AccountingCommandsService,
  ) {}

  @Post('recalculate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary:
      'Queue calculation runs (actuals, then both loss ledgers) for the periods overlapping [from, to) (202)',
    description:
      'Requires `Idempotency-Key`. unitIds must be units of the tenant and of the caller’s scope (422 ' +
      'INVALID_REFERENCE); without unitIds every unit is recalculated (403 TENANT_SCOPE_REQUIRED for unit-limited ' +
      'callers). ≤ 92 days. Returns the number of queued period jobs; an unchanged input set creates no run.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  recalculate(
    @Ctx() ctx: RequestContext,
    @Body() body: RecalculatePeriodsDto,
  ): Promise<{ queued: number }> {
    return this.commands.recalculate(ctx, body);
  }

  @Get(':id/accounting')
  @ApiOperation({
    summary:
      'Both loss ledgers of a period: revision, run (engine and policy versions, input fingerprint), totals, lines with evidence',
    description:
      'Default: the approved revision when one exists, else the draft. Quantities are decimal strings; ' +
      'residuals are signed and null when not computable. Foreign or out-of-scope periods are 404.',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PeriodAccountingQueryDto,
  ): Promise<AnalyticsResponse<PeriodAccountingV2View>> {
    return this.reads.get(ctx, id, query);
  }

  @Get(':id/runs')
  @ApiOperation({
    summary:
      'Calculation runs of a period, newest first (keyset on createdAt, id)',
  })
  runs(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CalculationRunListQueryDto,
  ): Promise<ListResponse<RunV2View>> {
    return this.reads.listRuns(ctx, id, query);
  }
}
