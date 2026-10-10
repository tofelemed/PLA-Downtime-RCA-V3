import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { CodeDefaultsService } from './code-defaults.service';
import { CodeLibraryCommandService } from './code-library-commands.service';
import { CodeLibraryService } from './code-library.service';
import { CodeMappingPreviewService } from './code-mapping-preview.service';
import { CodeMappingRule } from './code-mapping-rule.entity';
import { CodeMappingRuleService } from './code-mapping-rule.service';
import { CodeVersion } from './code-version.entity';
import { FailureCodeGroup } from './failure-code-group.entity';
import { LossCategoryDef } from './loss-category-def.entity';

/** Tenant-scoped, hierarchical, versioned code libraries and their mapping rules (plan 1.3). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReasonCode,
      ImpactCode,
      OEECode,
      FailureCodeGroup,
      LossCategoryDef,
      CodeVersion,
      CodeMappingRule,
      ProductionEvent,
    ]),
  ],
  providers: [
    CodeLibraryService,
    CodeLibraryCommandService,
    CodeMappingRuleService,
    CodeDefaultsService,
    CodeMappingPreviewService,
  ],
  exports: [
    CodeLibraryService,
    CodeLibraryCommandService,
    CodeMappingRuleService,
    CodeDefaultsService,
    CodeMappingPreviewService,
  ],
})
export class CodeLibraryModule {}
