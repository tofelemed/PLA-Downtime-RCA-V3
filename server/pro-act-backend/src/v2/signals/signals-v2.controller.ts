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
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { JobAccepted, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { INTEGRATION_WRITERS } from '../intake/intake-roles';
import {
  SignalListQueryDto,
  SignalV2WriteDto,
  SignalWindowDto,
} from './signal-v2.dto';
import {
  SignalBackfillV2View,
  SignalPreviewV2View,
  SignalV2View,
} from './signal-v2.view';
import { SignalsV2Service } from './signals-v2.service';

/** Typed measurement signals (plan 1.7, PI07–PI09, UX06): definitions, quantity preview, backfill. */
@ApiTags('v2 · Signals')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'signals', version: '2' })
export class SignalsV2Controller {
  constructor(private readonly service: SignalsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List signals of the caller tenant (keyset on createdAt, id)',
    description:
      'Every version is listed; current versions have effectiveTo = null.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: SignalListQueryDto,
  ): Promise<ListResponse<SignalV2View>> {
    return this.service.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Get one signal version; foreign ids are 404' })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SignalV2View> {
    return this.service.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...INTEGRATION_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Create a signal (or the next version of the signal of the same source key)',
    description:
      'Requires `Idempotency-Key`. A rate needs rateTimebase (422 RATE_TIMEBASE_REQUIRED); the unit must ' +
      'belong to the tenant (422 INVALID_REFERENCE); a next version starts after the current one.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: SignalV2WriteDto,
  ): Promise<SignalV2View> {
    return this.service.create(ctx, body);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview the quantity of a window without storing anything (UX06)',
    description:
      'Runs the quantity engine (counter delta, rate integration or output increments) on the latest ' +
      'sample revisions: quantity, method, coverage (measured / estimated / missing / excluded seconds), ' +
      'exceptions, the samples used and, for rates, stored PI Totals. At most 31 days / 50 000 samples.',
  })
  preview(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SignalWindowDto,
  ): Promise<SignalPreviewV2View> {
    return this.service.preview(ctx, id, body);
  }

  @Post(':id/backfill')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary:
      'Re-read [from, to) of this signal from PI (at most 90 days, ending by now)',
    description:
      'Requires `Idempotency-Key`. Answers 202 with the run status URL; the run is executed by a ' +
      'draining `backfill` ingestion job.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  backfill(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SignalWindowDto,
  ): Promise<JobAccepted> {
    return this.service.backfill(ctx, id, body);
  }

  @Get(':id/backfills/:runId')
  @ApiOperation({ summary: 'Status of a backfill run' })
  getBackfill(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ): Promise<SignalBackfillV2View> {
    return this.service.getBackfill(ctx, id, runId);
  }
}
