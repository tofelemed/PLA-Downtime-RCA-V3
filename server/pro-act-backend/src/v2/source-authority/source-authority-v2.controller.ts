import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  SourceAuthorityQueryDto,
  SourceAuthorityVersionDto,
} from './source-authority-v2.dto';
import { SourceAuthorityV2Service } from './source-authority-v2.service';
import {
  SOURCE_AUTHORITY_WRITERS,
  SourceAuthorityV2View,
  toSourceAuthorityView as toView,
} from './source-authority-v2.view';

/**
 * The output source authority in force (SRC01, D05) and its SME E7 measurement hierarchy: ranked sources
 * at one boundary — calibrated primary totalizer, redundant measurement, reconciled record, approved
 * estimate — that the period actuals select from, with a substitution flag when a lower rank is used.
 */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'source-authority', version: '2' })
export class SourceAuthorityV2Controller {
  constructor(private readonly versions: SourceAuthorityV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'The source authority version in force for a unit (its override, else tenant-wide)',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: SourceAuthorityQueryDto,
  ): Promise<SourceAuthorityV2View> {
    return toView(await this.versions.current(ctx, query.unitId));
  }

  @Post('versions')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...SOURCE_AUTHORITY_WRITERS)
  @ApiOperation({
    summary:
      'New source authority version with a measurement hierarchy (or none), effective now; the top rank becomes the primary source',
    description:
      'Requires `Idempotency-Key`. 403 TENANT_SCOPE_REQUIRED for a tenant-wide version without a tenant-wide grant; ' +
      '422 INVALID_REFERENCE (unit), INVALID_POLICY (ranks not unique, classes out of order, estimate not manual, ' +
      'same signal twice, lag on a non-signal source, top rank not at the hierarchy boundary).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async write(
    @Ctx() ctx: RequestContext,
    @Body() body: SourceAuthorityVersionDto,
  ): Promise<SourceAuthorityV2View> {
    return toView(await this.versions.write(ctx, body));
  }
}
