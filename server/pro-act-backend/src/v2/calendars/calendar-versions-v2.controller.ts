import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CalendarPublishService } from '../../calendar/calendar-publish.service';
import { CalendarVersionsService } from '../../calendar/calendar-versions.service';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CALENDAR_WRITERS } from './calendar-roles';
import {
  CalendarPublishDto,
  CalendarVersionCreateDto,
  CalendarVersionListQueryDto,
  CalendarVersionPatchDto,
} from './calendar-version-v2.dto';
import {
  CalendarPublishV2View,
  CalendarVersionV2View,
  toCalendarVersionView,
  toPublishView,
} from './calendar-v2.view';
import { CalendarsV2Service } from './calendars-v2.service';

/** Versioned site calendars and unit overrides (plan 2.1, CAL01, §15.2). */
@ApiTags('v2 · Calendars')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'calendar-versions', version: '2' })
export class CalendarVersionsV2Controller {
  constructor(
    private readonly lists: CalendarsV2Service,
    private readonly versions: CalendarVersionsService,
    private readonly publisher: CalendarPublishService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List calendar versions of the caller tenant (keyset on createdAt, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: CalendarVersionListQueryDto,
  ): Promise<ListResponse<CalendarVersionV2View>> {
    return this.lists.listVersions(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Get one calendar version (ETag = rowVersion); foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CalendarVersionV2View> {
    return toCalendarVersionView(await this.versions.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...CALENDAR_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Create a draft calendar version (next version of the site calendar or unit override)',
    description:
      'Requires `Idempotency-Key`. siteId / unitId must be of the tenant (422 INVALID_REFERENCE); timezone and ' +
      'operational day start default to the site. Two weeks are generated to validate it (422 ' +
      'OVERLAPPING_SHIFTS, INVALID_TIMEZONE, DUPLICATE_SHIFT_NAME, INVALID_EXCLUSION, ...).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CalendarVersionCreateDto,
  ): Promise<CalendarVersionV2View> {
    return toCalendarVersionView(await this.versions.create(ctx, body));
  }

  @Patch(':id')
  @Roles(...CALENDAR_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Edit a draft calendar version',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 without, 412 when stale). A published version is immutable: ' +
      '409 CALENDAR_VERSION_PUBLISHED (create a new version instead).',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRevision: number,
    @Body() body: CalendarVersionPatchDto,
  ): Promise<CalendarVersionV2View> {
    return toCalendarVersionView(
      await this.versions.update(ctx, { id, expectedRevision }, body),
    );
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...CALENDAR_WRITERS)
  @ApiOperation({
    summary: 'Publish a calendar version and generate its shift instances',
    description:
      'Requires `Idempotency-Key`. Generates instances of the governed units from max(effectiveFrom, today − 366 d) ' +
      'to today + 90 d: future dates are regenerated, past dates only filled. Re-publishing needs a reason ' +
      '(409 ALREADY_PUBLISHED without) and may regenerate past dates from regenerateFrom (audited).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async publish(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CalendarPublishDto,
  ): Promise<CalendarPublishV2View> {
    return toPublishView(await this.publisher.publish(ctx, id, body));
  }
}
