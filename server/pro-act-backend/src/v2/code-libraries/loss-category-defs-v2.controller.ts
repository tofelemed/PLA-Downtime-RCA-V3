import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

/** Loss categories (hierarchical, ordered by reportOrder in reports). */
@ApiTags('v2 · Loss Category Definitions')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'loss-category-defs', version: '2' })
export class LossCategoryDefsV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'loss_category' as const;

  constructor(reads: CodeLibraryService, commands: CodeLibraryCommandService) {
    super(reads, commands);
  }
}
