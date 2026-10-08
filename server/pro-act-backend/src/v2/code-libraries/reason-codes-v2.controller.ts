import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

/** Reason (cause) codes: hierarchical, with classification defaults (OEE component, schedule class, impact code). */
@ApiTags('v2 · Reason Codes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reason-codes', version: '2' })
export class ReasonCodesV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'reason' as const;

  constructor(reads: CodeLibraryService, commands: CodeLibraryCommandService) {
    super(reads, commands);
  }
}
