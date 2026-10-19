import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  RcaCausesService,
  RcaCaseCauseV2View,
} from '../../rca-case/rca-causes.service';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RcaCaseCauseV2CreateDto,
  RcaCaseCauseV2UpdateDto,
} from './rca-case-causes-v2.dto';

const RULES =
  'Writers: reliability engineer or manager approver, in the case scope. Locked once closure is requested ' +
  '(Closure Review, Closed: 422 CAUSES_LOCKED). A retired catalogue cause cannot be newly assigned (422 ' +
  'CAUSE_CODE_RETIRED); evidenceIds / nodeIds must be items of the case (422 INVALID_REFERENCE).' +
  ' 409 CASE_CLOSED on a closed investigation (reopen it first).';

/** Typed causes of a case (item 7), linked to the cause catalogue. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class RcaCaseCausesV2Controller {
  constructor(private readonly causes: RcaCausesService) {}

  @Get('rcas/:id/causes')
  @ApiOperation({ summary: 'Direct, contributing and root causes of a case' })
  list(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaCaseCauseV2View[]> {
    return this.causes.list(ctx, id);
  }

  @Post('rcas/:id/causes')
  @Idempotent()
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Add a cause',
    description: `Requires \`Idempotency-Key\`. ${RULES}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RcaCaseCauseV2CreateDto,
  ): Promise<RcaCaseCauseV2View> {
    return this.causes.create(ctx, id, body);
  }

  @Patch('rca-case-causes/:id')
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Change a cause',
    description: `Requires \`If-Match\` (428/412). ${RULES}`,
  })
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RcaCaseCauseV2UpdateDto,
  ): Promise<RcaCaseCauseV2View> {
    return this.causes.update(ctx, { id, expectedRowVersion }, body);
  }

  @Delete('rca-case-causes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Remove a cause',
    description: `Requires \`If-Match\` (428/412). ${RULES}`,
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<void> {
    await this.causes.remove(ctx, { id, expectedRowVersion });
  }
}
