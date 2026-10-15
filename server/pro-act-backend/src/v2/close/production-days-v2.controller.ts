import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DayCertificationService } from '../../close/day-certification.service';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { daysBetween, isLocalDate } from '../../domain/calendar/wall-clock';
import { invalid } from '../../profiles/profile-errors';
import { ListResponse, listResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { DAY_CERTIFIERS } from './close-roles';
import {
  DayV2View,
  DaySummaryV2View,
  toDaySummaryView,
  toDayView,
} from './production-day.view';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 62;

export class DayParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2027-03-01', description: 'Operational date' })
  @Matches(DATE)
  localDate: string;
}

export class DayListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: '2027-03-01' })
  @Matches(DATE)
  from: string;

  @ApiProperty({
    example: '2027-03-31',
    description: `Inclusive; at most ${MAX_DAYS} days after from`,
  })
  @Matches(DATE)
  to: string;
}

export class CertifyDayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** Day certification of the production days of a unit (owner decision 14 Oct 2026, SME R2; phase R-E). */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-days', version: '2' })
export class ProductionDaysV2Controller {
  constructor(private readonly days: DayCertificationService) {}

  @Get()
  @ApiOperation({
    summary: `Production days of a unit on [from, to] (≤ ${MAX_DAYS} days): state (open, ready, certified) and shift periods`,
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: DayListQueryDto,
  ): Promise<ListResponse<DaySummaryV2View>> {
    const valid = isLocalDate(query.from) && isLocalDate(query.to);
    const span = valid ? daysBetween(query.from, query.to) : -1;
    if (span < 0 || span > MAX_DAYS) {
      throw invalid(
        'INVALID_RANGE',
        `to must be 0–${MAX_DAYS} days after from`,
      );
    }
    const days = await this.days.list(ctx, query);
    return listResponse(days.map(toDaySummaryView), null, {
      tenantId: requireTenantId(ctx),
      unitIds: [query.unitId],
    });
  }

  @Get(':unitId/:localDate')
  @ApiOperation({
    summary:
      'A production day: shift periods with their workflow, the certification and the roll-up of the approved shifts per unit of measure',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param() params: DayParamDto,
  ): Promise<DayV2View> {
    return toDayView(await this.days.day(ctx, params.unitId, params.localDate));
  }

  @Post(':unitId/:localDate/certify')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...DAY_CERTIFIERS)
  @ApiOperation({
    summary:
      'One approval certifies the day: the roll-up of its approved shift revisions (each quantity stays on its shift)',
    description:
      'Requires `Idempotency-Key`. 422 DAY_NOT_READY (details list the shifts not approved), 409 DAY_CERTIFIED, ' +
      '403 SEPARATION_OF_DUTIES for a submitter of one of the shifts. A revise of a shift reopens the day.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async certify(
    @Ctx() ctx: RequestContext,
    @Param() params: DayParamDto,
    @Body() body: CertifyDayDto,
  ): Promise<DayV2View> {
    return toDayView(
      await this.days.certify(ctx, params, body.comment ?? null),
    );
  }
}
