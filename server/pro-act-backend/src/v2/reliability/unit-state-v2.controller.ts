import { AnalogThresholds } from '../../domain/reliability/analog-state';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { StateRule } from '../../domain/reliability/unit-state';
import { UnitStateMapping } from '../../reliability/entities/unit-state-mapping.entity';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { toIso } from './reliability-v2-common';
import { STATE_MAPPING_WRITERS } from './reliability-roles';
import {
  UnitStateCoverageQueryDto,
  UnitStateMappingCreateDto,
  UnitStateMappingListQueryDto,
} from './unit-state-v2.dto';
import {
  UnitStateCoverageV2View,
  UnitStateV2Service,
} from './unit-state-v2.service';

export interface UnitStateMappingV2View {
  id: string;
  unitId: string;
  signalId: string;
  version: number;
  rules: StateRule[];
  /** plan 1.10 analog thresholds; null = rules only */
  thresholds: AnalogThresholds | null;
  expectedIntervalSeconds: number;
  jitterSeconds: number;
  staleAfterIntervals: number;
  isHeartbeat: boolean;
  /** seconds after a heartbeat sample until it is stale */
  staleAfterSeconds: number | null;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

const toView = (m: UnitStateMapping): UnitStateMappingV2View => ({
  id: m.id,
  unitId: m.unitId,
  signalId: m.signalId,
  version: m.version,
  rules: m.rules,
  thresholds: m.thresholds ?? null,
  expectedIntervalSeconds: m.expectedIntervalSeconds,
  jitterSeconds: m.jitterSeconds,
  staleAfterIntervals: m.staleAfterIntervals,
  isHeartbeat: m.isHeartbeat,
  staleAfterSeconds: m.isHeartbeat
    ? m.staleAfterIntervals * m.expectedIntervalSeconds + m.jitterSeconds
    : null,
  notes: m.notes,
  effectiveFrom: m.effectiveFrom.toISOString(),
  effectiveTo: toIso(m.effectiveTo),
});

/** Unit state engine (SME D1 / D2): signal → state mappings, staleness and coverage bounds. */
@ApiTags('v2 · Unit state')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'unit-state-mappings', version: '2' })
export class UnitStateV2Controller {
  constructor(private readonly states: UnitStateV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'State mapping versions of one unit (newest first; keyset on version)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: UnitStateMappingListQueryDto,
  ): Promise<ListResponse<UnitStateMappingV2View>> {
    const page = await this.states.list(ctx, query);
    return listResponse(page.items.map(toView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
      unitIds: [query.unitId],
    });
  }

  @Get('coverage')
  @ApiOperation({
    summary:
      'State timeline, known-data coverage and availability bounds of a unit over a window',
    description:
      'Scheduled time = the window minus excluded shifts. Unknown time (no data, stale heartbeat, bad or ' +
      'uncertain quality, unmapped value) is never filled: availability lies between running / scheduled and ' +
      '(running + unknown) / scheduled; `knownTimeAvailability` is conditional on observed time only. ' +
      '`coverage` null = no mapping at `from`. Window ≤ 31 days (422 INVALID_RANGE).',
  })
  coverage(
    @Ctx() ctx: RequestContext,
    @Query() query: UnitStateCoverageQueryDto,
  ): Promise<UnitStateCoverageV2View> {
    return this.states.coverage(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...STATE_MAPPING_WRITERS)
  @ApiOperation({
    summary:
      'Record a new version of a unit’s state mapping from effectiveFrom',
    description:
      'Requires `Idempotency-Key`. The signal must be a state signal of the unit (422). The previous version ' +
      'ends at effectiveFrom. Physical state only: schedule status comes from the calendar, causes from events.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: UnitStateMappingCreateDto,
  ): Promise<UnitStateMappingV2View> {
    return toView(await this.states.create(ctx, body));
  }
}
