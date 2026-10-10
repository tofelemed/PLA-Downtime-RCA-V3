import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import {
  CodeMappingPreviewService,
  CodeMappingPreviewV2View,
  PREVIEW_DAYS_DEFAULT,
} from '../../code-library/code-mapping-preview.service';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

export class CodeMappingPreviewQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 92,
    default: PREVIEW_DAYS_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(92)
  days?: number;
}

/** Reason (cause) codes: hierarchical, with classification defaults (OEE component, schedule class, impact code). */
@ApiTags('v2 · Reason Codes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reason-codes', version: '2' })
export class ReasonCodesV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'reason' as const;

  constructor(
    reads: CodeLibraryService,
    commands: CodeLibraryCommandService,
    private readonly previews: CodeMappingPreviewService,
  ) {
    super(reads, commands);
  }

  @Get(':id/mapping-preview')
  @ApiOperation({
    summary: 'Default mapping preview of a reason code',
    description:
      'The defaults in force now (mapping rule version, else the code columns) and how the events coded ' +
      'with the code in the last `days` days (caller scope) are classified today, with the count that ' +
      'would differ.',
  })
  mappingPreview(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CodeMappingPreviewQueryDto,
  ): Promise<CodeMappingPreviewV2View> {
    return this.previews.preview(ctx, id, query.days);
  }
}
