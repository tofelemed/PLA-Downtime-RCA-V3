import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

/** Impact codes (flat; GE impact codes such as OTSD, RMDD are ordinary codes of the tenant). */
@ApiTags('v2 · Impact Codes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'impact-codes', version: '2' })
export class ImpactCodesV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'impact' as const;

  constructor(reads: CodeLibraryService, commands: CodeLibraryCommandService) {
    super(reads, commands);
  }
}
