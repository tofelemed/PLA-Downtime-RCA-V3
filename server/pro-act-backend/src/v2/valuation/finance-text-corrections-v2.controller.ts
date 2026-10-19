import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { FinanceTextCorrectionsService } from '../../valuation/finance-text-corrections.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  DemandStatusV2View,
  toDemandStatusView,
} from './demand-status-v2.view';
import {
  DemandEvidenceCorrectionDto,
  FxSourceCorrectionDto,
  PolicyTextCorrectionDto,
} from './finance-text-v2.dto';
import { FINANCE_MAINTAINERS } from './valuation-roles';
import {
  FxRateV2View,
  toFxRateView,
  toValuationPolicyView,
  ValuationPolicyV2View,
} from './valuation-v2.view';

const TEXT_ONLY =
  'Corrects descriptive text only (QA re-test N3): figures, validity, state and approval are unchanged, so ' +
  'nothing is revalued and an approved version stays approved; the change is in the audit log. Finance ' +
  'maintainers with a tenant-wide grant (403 TENANT_SCOPE_REQUIRED); foreign ids are 404.';

/** Text corrections of finance records (FX source, demand evidence, policy notes). */
@ApiTags('v2 · Valuation')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class FinanceTextCorrectionsV2Controller {
  constructor(private readonly corrections: FinanceTextCorrectionsService) {}

  @Patch('fx-rates/:id/source')
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary: 'Correct the source text of an FX rate version',
    description: TEXT_ONLY,
  })
  async fxSource(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: FxSourceCorrectionDto,
  ): Promise<FxRateV2View> {
    return toFxRateView(await this.corrections.fxSource(ctx, id, body.source));
  }

  @Patch('demand-statuses/:id/evidence')
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary: 'Correct the evidence text of a demand status version',
    description: TEXT_ONLY,
  })
  async demandEvidence(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DemandEvidenceCorrectionDto,
  ): Promise<DemandStatusV2View> {
    return toDemandStatusView(
      await this.corrections.demandEvidence(ctx, id, body.evidence),
    );
  }

  @Patch('valuation-policies/:id/text')
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary:
      'Correct the notes or backdate reason of a valuation policy version',
    description: `${TEXT_ONLY} 422 NOTHING_TO_CORRECT (empty body), NOT_BACKDATED (backdateReason on a version that was not backdated).`,
  })
  async policyText(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PolicyTextCorrectionDto,
  ): Promise<ValuationPolicyV2View> {
    return toValuationPolicyView(
      await this.corrections.policyText(ctx, id, body),
    );
  }
}
