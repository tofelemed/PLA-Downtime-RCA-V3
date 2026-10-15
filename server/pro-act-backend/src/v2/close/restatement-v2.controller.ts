import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  POSTING_TREATMENTS,
  PostingTreatment,
} from '../../reconciliation/entities/restatement-posting.entity';
import { RestatementService } from '../../reconciliation/restatement.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { POSTING_DECIDERS } from './close-roles';
import { RestatementV2View, toRestatementView } from './restatement-v2.view';

export class RestatementQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Default: the latest revision that is not cancelled',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision?: number;
}

export class PostingDecisionDto {
  @ApiProperty({
    example: '2026-11-03',
    description: 'Financial posting date chosen by finance (YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'postingDate must be YYYY-MM-DD' })
  postingDate: string;

  @ApiProperty({ enum: POSTING_TREATMENTS })
  @IsIn(POSTING_TREATMENTS)
  treatment: PostingTreatment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Restatement of an approved period (SME R5, phase R-D): delta view and finance's posting decision. */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-periods', version: '2' })
export class RestatementV2Controller {
  constructor(private readonly restatements: RestatementService) {}

  @Get(':id/restatement')
  @ApiOperation({
    summary:
      'Delta of a restating revision against the approved revision it supersedes: totals and actuals per unit of measure, lines by kind and reason (old, new, delta), and the posting decision',
    description:
      '422 NOT_A_RESTATEMENT when the revision supersedes no approved revision. The operational effective date is the period’s date; the posting date is finance’s.',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RestatementQueryDto,
  ): Promise<RestatementV2View> {
    return toRestatementView(
      await this.restatements.read(ctx, id, query.revision),
    );
  }

  @Post(':id/revisions/:revision/posting')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...POSTING_DECIDERS)
  @ApiOperation({
    summary:
      'Finance sets the posting date and treatment of a restatement (correction, estimate change, other adjustment, no posting)',
    description:
      'Requires `Idempotency-Key`. A later decision replaces the earlier one (audited). 422 NOT_A_RESTATEMENT.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async decide(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('revision', ParseIntPipe) revision: number,
    @Body() body: PostingDecisionDto,
  ): Promise<RestatementV2View> {
    return toRestatementView(
      await this.restatements.decidePosting(ctx, id, revision, {
        postingDate: body.postingDate,
        treatment: body.treatment,
        note: body.note ?? null,
      }),
    );
  }
}
