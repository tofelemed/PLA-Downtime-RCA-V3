import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RuleRun } from './entities/rule-run.entity';
import { RuleVersion } from './entities/rule-version.entity';
import { Rule } from './entities/rule.entity';
import { RuleClassificationService } from './rule-classification.service';
import { RuleCommandsService } from './rule-commands.service';
import { RuleSimulationService } from './rule-simulation.service';
import { RulesService } from './rules.service';

/** Declarative admin rules: grammar, versions, simulation and the server-side interpreter (plan 3.8). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rule, RuleVersion, RuleRun, ProductionEvent]),
  ],
  providers: [
    RulesService,
    RuleCommandsService,
    RuleSimulationService,
    RuleClassificationService,
  ],
  exports: [
    RulesService,
    RuleCommandsService,
    RuleSimulationService,
    RuleClassificationService,
  ],
})
export class RulesModule {}
