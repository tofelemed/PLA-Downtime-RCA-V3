import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { STANDBY_WRITERS } from './reliability-roles';
import { StandbyEquipmentV2Service } from './standby-equipment-v2.service';
import { StandbyRecordsV2Service } from './standby-records-v2.service';
import {
  StandbyEquipmentCreateDto,
  StandbyEquipmentRetireDto,
  StandbyListQueryDto,
  StandbyMetricsQueryDto,
  StandbyRecordsImportDto,
} from './standby-v2.dto';
import {
  StandbyEquipmentV2View,
  StandbyImportV2View,
  StandbyMetricsV2View,
  StandbyRecordV2View,
  toStandbyEquipmentView,
  toStandbyRecordView,
} from './standby-v2.view';

/** Standby equipment, its demand / test log and its measures (SME D9). */
@ApiTags('v2 · Standby equipment')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class StandbyV2Controller {
  constructor(
    private readonly equipment: StandbyEquipmentV2Service,
    private readonly records: StandbyRecordsV2Service,
  ) {}

  @Get('standby-equipment')
  @ApiOperation({
    summary:
      'Standby registrations of the caller scope (keyset on effectiveFrom)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: StandbyListQueryDto,
  ): Promise<ListResponse<StandbyEquipmentV2View>> {
    const page = await this.equipment.list(ctx, query);
    return listResponse(
      page.items.map(toStandbyEquipmentView),
      page.nextCursor,
      { tenantId: requireTenantId(ctx) },
    );
  }

  @Get('standby-equipment/metrics')
  @ApiOperation({
    summary:
      'Failure on demand, test failures, operating MTBF and exposure per standby asset',
    description:
      'For every asset registered as standby in [from, to): start demands, failed starts and their fraction; tests ' +
      'separately; running seconds (the asset’s own exposure) and failures while running — with no failure the ' +
      'operating MTBF is null with reason `no_failures` and the exposure is shown, never an infinite value; standby ' +
      'seconds apart from it. 422 INVALID_RANGE when from ≥ to.',
  })
  metrics(
    @Ctx() ctx: RequestContext,
    @Query() query: StandbyMetricsQueryDto,
  ): Promise<StandbyMetricsV2View[]> {
    return this.equipment.metrics(ctx, query);
  }

  @Post('standby-equipment')
  @Idempotent()
  @Roles(...STANDBY_WRITERS)
  @ApiOperation({
    summary: 'Register an asset as standby equipment from effectiveFrom',
    description:
      'Requires `Idempotency-Key`. 409 STANDBY_ALREADY_REGISTERED while a registration is open.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async register(
    @Ctx() ctx: RequestContext,
    @Body() body: StandbyEquipmentCreateDto,
  ): Promise<StandbyEquipmentV2View> {
    return toStandbyEquipmentView(await this.equipment.register(ctx, body));
  }

  @Post('standby-equipment/:id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...STANDBY_WRITERS)
  @ApiOperation({ summary: 'End a standby duty (its log stays)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StandbyEquipmentRetireDto,
  ): Promise<StandbyEquipmentV2View> {
    return toStandbyEquipmentView(
      await this.equipment.retire(ctx, id, body.effectiveTo),
    );
  }

  @Get('standby-records')
  @ApiOperation({
    summary:
      'Demand / test / running log entries (keyset on startedAt; from / to overlap)',
  })
  async listRecords(
    @Ctx() ctx: RequestContext,
    @Query() query: StandbyListQueryDto,
  ): Promise<ListResponse<StandbyRecordV2View>> {
    const page = await this.records.list(ctx, query);
    return listResponse(page.items.map(toStandbyRecordView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Post('standby-records/import')
  @HttpCode(200)
  @Idempotent()
  @Roles(...STANDBY_WRITERS)
  @ApiOperation({
    summary: 'Import demand / test / running log entries (all or nothing)',
    description:
      'Requires `Idempotency-Key`. The asset by id or code; an entry with an `externalRef` already stored is ' +
      'replaced. 422 STANDBY_IMPORT_INVALID lists the row problems (`details.errors`).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  importRecords(
    @Ctx() ctx: RequestContext,
    @Body() body: StandbyRecordsImportDto,
  ): Promise<StandbyImportV2View> {
    return this.records.import(ctx, body);
  }
}
