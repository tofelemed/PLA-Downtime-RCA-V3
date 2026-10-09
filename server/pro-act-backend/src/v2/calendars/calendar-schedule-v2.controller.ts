import { ReadOnlyAllowed } from '../../auth/decorators/read-only-allowed.decorator';
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarPreviewService } from '../../calendar/calendar-preview.service';
import { SitesService } from '../../calendar/sites.service';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  CalendarPreviewDto,
  ShiftInstanceListQueryDto,
  SiteListQueryDto,
} from './calendar-query-v2.dto';
import {
  CalendarPreviewV2View,
  ShiftInstanceV2View,
  SiteV2View,
  toPreviewView,
  toSiteView,
} from './calendar-v2.view';
import { CalendarsV2Service } from './calendars-v2.service';

/** Reads of plan 2.1: sites, generated shift instances, and the calendar preview (§15.2). */
@ApiTags('v2 · Calendars')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class CalendarScheduleV2Controller {
  constructor(
    private readonly lists: CalendarsV2Service,
    private readonly sites: SitesService,
    private readonly previews: CalendarPreviewService,
  ) {}

  @Get('sites')
  @ApiOperation({
    summary:
      'List sites of the caller tenant (timezone, operational day start)',
  })
  listSites(
    @Ctx() ctx: RequestContext,
    @Query() query: SiteListQueryDto,
  ): Promise<ListResponse<SiteV2View>> {
    return this.lists.listSites(ctx, query);
  }

  @Get('sites/:id')
  @ApiOperation({ summary: 'Get one site; foreign ids are 404' })
  async getSite(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SiteV2View> {
    return toSiteView(await this.sites.get(ctx, id));
  }

  @Get('shift-instances')
  @ApiOperation({
    summary:
      'List generated shift instances (overlap of [from, to), keyset on utcStart, id)',
    description:
      'UTC bounds with the offsets (minutes east of UTC) in force at start and just before the end, and the ' +
      'stored local labels. Unit-scoped callers see only their units.',
  })
  listInstances(
    @Ctx() ctx: RequestContext,
    @Query() query: ShiftInstanceListQueryDto,
  ): Promise<ListResponse<ShiftInstanceV2View>> {
    return this.lists.listInstances(ctx, query);
  }

  @ReadOnlyAllowed()
  @Post('calendars/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Preview a candidate calendar for one unit without storing anything',
    description:
      'Exactly one of candidateVersionId (a version of the unit or its site) and candidateVersion (inline). ' +
      'Returns the instances, DST / crew warnings and the diff against the stored instances; at most 62 days.',
  })
  async preview(
    @Ctx() ctx: RequestContext,
    @Body() body: CalendarPreviewDto,
  ): Promise<CalendarPreviewV2View> {
    return toPreviewView(await this.previews.preview(ctx, body));
  }
}
