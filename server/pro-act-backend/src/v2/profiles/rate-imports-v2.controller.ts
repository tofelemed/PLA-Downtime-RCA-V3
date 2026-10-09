import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { RateImportsService } from '../../profiles/rate-imports.service';
import { JobAccepted } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS } from './profile-roles';
import { RateImportV2View, toRateImportView } from './profile-v2.view';
import { RateImportCreateDto } from './rate-v2.dto';

/** Budget / forecast / MPC imports (plan 2.2 step 4, PLAN06, API04). */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rate-imports', version: '2' })
export class RateImportsV2Controller {
  constructor(private readonly imports: RateImportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary:
      'Import one revision of a budget, forecast or MPC document (202 job)',
    description:
      'Requires `Idempotency-Key`. rows xor csv. The worker applies the document whole or not at all: every ' +
      'row must name a unit and product of the tenant with an approved profile at effectiveFrom and must not ' +
      'overlap another row or an approved rate of another document; otherwise the import is `failed` with a ' +
      'report per line. A later revision of the same externalId retires the rows of earlier revisions ' +
      '(correction). Imported rows are approved versions (`source = import`); mpc rows are sustained rates.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: RateImportCreateDto,
  ): Promise<JobAccepted> {
    const job = await this.imports.request(ctx, body);
    return { jobId: job.id, statusUrl: `/api/v2/rate-imports/${job.id}` };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Status and validation report of a rate import',
    description:
      'state queued → completed | failed; `report` lists each invalid line. Foreign ids are 404.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RateImportV2View> {
    return toRateImportView(await this.imports.get(ctx, id));
  }
}
