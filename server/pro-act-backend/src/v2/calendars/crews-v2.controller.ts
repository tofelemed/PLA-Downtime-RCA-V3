import {
  Body,
  Controller,
  Get,
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
import { CrewsService } from '../../calendar/crews.service';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CALENDAR_WRITERS } from './calendar-roles';
import { CalendarsV2Service } from './calendars-v2.service';
import {
  CrewCreateDto,
  CrewListQueryDto,
  CrewRotationCreateDto,
  CrewRotationListQueryDto,
} from './crew-v2.dto';
import {
  CrewRotationCreatedV2View,
  CrewRotationV2View,
  CrewV2View,
  toCrewView,
  toRotationView,
} from './crew-v2.view';

/** Crews and rotations (plan 2.1, CAL02): assignment only, never part of the denominator. */
@ApiTags('v2 · Calendars')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class CrewsV2Controller {
  constructor(
    private readonly lists: CalendarsV2Service,
    private readonly crews: CrewsService,
  ) {}

  @Get('crews')
  @ApiOperation({ summary: 'List crews of the caller tenant' })
  listCrews(
    @Ctx() ctx: RequestContext,
    @Query() query: CrewListQueryDto,
  ): Promise<ListResponse<CrewV2View>> {
    return this.lists.listCrews(ctx, query);
  }

  @Get('crews/:id')
  @ApiOperation({ summary: 'Get one crew; foreign ids are 404' })
  async getCrew(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CrewV2View> {
    return toCrewView(await this.crews.getCrew(ctx, id));
  }

  @Post('crews')
  @Idempotent()
  @Roles(...CALENDAR_WRITERS)
  @ApiOperation({
    summary: 'Create a crew of a site',
    description:
      'Requires `Idempotency-Key`. siteId must be of the tenant (422 INVALID_REFERENCE; default: the default ' +
      'site); a second crew of the same name on the site is 409 CREW_EXISTS.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createCrew(
    @Ctx() ctx: RequestContext,
    @Body() body: CrewCreateDto,
  ): Promise<CrewV2View> {
    return toCrewView(await this.crews.createCrew(ctx, body));
  }

  @Get('crew-rotations')
  @ApiOperation({ summary: 'List crew rotations of the caller tenant' })
  listRotations(
    @Ctx() ctx: RequestContext,
    @Query() query: CrewRotationListQueryDto,
  ): Promise<ListResponse<CrewRotationV2View>> {
    return this.lists.listRotations(ctx, query);
  }

  @Post('crew-rotations')
  @Idempotent()
  @Roles(...CALENDAR_WRITERS)
  @ApiOperation({
    summary: 'Add a rotation to a crew and re-assign crews on future instances',
    description:
      'Requires `Idempotency-Key`. crewId must be of the tenant (422 INVALID_REFERENCE). On operational date d ' +
      'the crew works cycle[(d − anchorDate) mod length] (null = off); bounds and scheduled time never change.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createRotation(
    @Ctx() ctx: RequestContext,
    @Body() body: CrewRotationCreateDto,
  ): Promise<CrewRotationCreatedV2View> {
    const { rotation, materialization } = await this.crews.createRotation(
      ctx,
      body,
    );
    return { rotation: toRotationView(rotation), materialization };
  }
}
