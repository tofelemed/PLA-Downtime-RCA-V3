import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/profiles.module';
import { BufferLevelsService } from './buffer-levels.service';
import { BufferLevelRecord } from './entities/buffer-level.entity';
import { PlantFlowRoute } from './entities/plant-flow-route.entity';
import { StreamRunRecord } from './entities/stream-run.entity';
import { PlantFlowRoutesService } from './plant-flow-routes.service';
import { UnitStream } from './entities/unit-stream.entity';
import { StreamRunsService } from './stream-runs.service';
import { UnitStreamsService } from './unit-streams.service';

/** SME E6 / E2 plant model: unit streams and the products they run (and, with E2, the material-flow map). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UnitStream,
      StreamRunRecord,
      PlantFlowRoute,
      BufferLevelRecord,
    ]),
    ProfilesModule,
  ],
  providers: [
    UnitStreamsService,
    StreamRunsService,
    PlantFlowRoutesService,
    BufferLevelsService,
  ],
  exports: [
    UnitStreamsService,
    StreamRunsService,
    PlantFlowRoutesService,
    BufferLevelsService,
    TypeOrmModule,
  ],
})
export class PlantModelModule {}
