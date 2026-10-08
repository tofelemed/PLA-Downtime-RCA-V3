import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CodeLibraryCommandService } from '../../code-library/code-library-commands.service';
import { CodeLibraryService } from '../../code-library/code-library.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CodeLibraryV2Controller } from './code-library-v2.controller';

/** Failure taxonomy: class → problem → cause → remedy (a child sits one level below its parent). */
@ApiTags('v2 · Failure Code Groups')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'failure-code-groups', version: '2' })
export class FailureCodeGroupsV2Controller extends CodeLibraryV2Controller {
  protected readonly library = 'failure' as const;

  constructor(reads: CodeLibraryService, commands: CodeLibraryCommandService) {
    super(reads, commands);
  }
}
