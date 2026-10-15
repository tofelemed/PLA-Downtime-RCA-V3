import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  StopVerificationService,
  VERIFY_LIMIT,
  VerificationOutcome,
} from './stop-verification.service';
import { FAILURE_VALIDATORS, STOP_VERIFIERS } from './verification-roles';

/** `POST /production-events/verification`: explicitly selected stops, or every unverified stop of a shift. */
export class VerifyStopsV2Dto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: VERIFY_LIMIT,
    description: 'Stops to verify (exclusive with periodId)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(VERIFY_LIMIT)
  @IsUUID('all', { each: true })
  eventIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Bulk verify of a shift: every unverified stop overlapping the production period (exclusive with eventIds)',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}

/** SME D13: staged verification of stop coding (operator enters → supervisor verifies → maintenance validates). */
@ApiTags('v2 · Production Events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class StopVerificationV2Controller {
  constructor(private readonly verification: StopVerificationService) {}

  @Post('verification')
  @Roles(...STOP_VERIFIERS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the coding of stops as their supervisor (SME D13)',
    description:
      'Supervisor = manager_approver or production_engineer of the stop’s unit. Stops that do not qualify are ' +
      'skipped with the reason (NOT_FOUND, NOT_AUTHORIZED, NOT_A_STOP, NOT_CODED — neither a reason code nor ' +
      '"investigation pending", ALREADY_VERIFIED, OWN_CODING — the verifier entered the current coding). A later ' +
      'change of the coding clears the verification. 422 SELECTION_REQUIRED unless exactly one of eventIds / periodId.',
  })
  verify(
    @Ctx() ctx: RequestContext,
    @Body() body: VerifyStopsV2Dto,
  ): Promise<VerificationOutcome> {
    return this.verification.verify(ctx, body);
  }

  @Post(':id/validate-failure')
  @Roles(...FAILURE_VALIDATORS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Validate the technical failure detail of a verified stop (SME D13, maintenance)',
    description:
      'Maintenance = reliability_engineer of the stop’s unit. Skipped with the reason: NO_FAILURE_DETAIL, ' +
      'NOT_VERIFIED (the supervisor verifies first), ALREADY_VALIDATED, OWN_CODING, NOT_AUTHORIZED, NOT_FOUND. ' +
      'A later change of the failure detail clears the validation.',
  })
  validate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VerificationOutcome> {
    return this.verification.validate(ctx, id);
  }
}
