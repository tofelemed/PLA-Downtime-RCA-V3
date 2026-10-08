import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

/** OEE codes (flat). */
@ApiTags('v2 · OEE Codes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'oee-codes', version: '2' })
export class OeeCodesV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'oee' as const;

  constructor(reads: CodeLibraryService, commands: CodeLibraryCommandService) {
    super(reads, commands);
  }
}
