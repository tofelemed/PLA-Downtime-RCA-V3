import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/profiles.module';
import { BufferLevelsService } from './buffer-levels.service';
import { BufferLevelRecord } from './entities/buffer-level.entity';
import { PlantFlowRoute } from './entities/plant-flow-route.entity';
import { StreamRunRecord } from './entities/stream-run.entity';
import { PlantFlowRoutesService } from './plant-flow-routes.service';
import { UnitImpactRule } from './entities/unit-impact-rule.entity';
import { UnitStream } from './entities/unit-stream.entity';
import { StreamRunsService } from './stream-runs.service';
import { UnitImpactRulesService } from './unit-impact-rules.service';
import { UnitStreamsService } from './unit-streams.service';

/** SME E6 / E2 plant model: unit streams and the products they run (and, with E2, the material-flow map; plan 1.10 unit impact rules). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UnitStream,
      StreamRunRecord,
      PlantFlowRoute,
      BufferLevelRecord,
      UnitImpactRule,
    ]),
    ProfilesModule,
  ],
  providers: [
    UnitStreamsService,
    StreamRunsService,
    PlantFlowRoutesService,
    BufferLevelsService,
    UnitImpactRulesService,
  ],
  exports: [
    UnitStreamsService,
    StreamRunsService,
    PlantFlowRoutesService,
    BufferLevelsService,
    UnitImpactRulesService,
    TypeOrmModule,
  ],
})
export class PlantModelModule {}
