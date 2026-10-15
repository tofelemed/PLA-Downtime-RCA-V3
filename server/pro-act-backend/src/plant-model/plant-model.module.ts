import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/profiles.module';
import { StreamRunRecord } from './entities/stream-run.entity';
import { UnitStream } from './entities/unit-stream.entity';
import { StreamRunsService } from './stream-runs.service';
import { UnitStreamsService } from './unit-streams.service';

/** SME E6 / E2 plant model: unit streams and the products they run (and, with E2, the material-flow map). */
@Module({
  imports: [
    TypeOrmModule.forFeature([UnitStream, StreamRunRecord]),
    ProfilesModule,
  ],
  providers: [UnitStreamsService, StreamRunsService],
  exports: [UnitStreamsService, StreamRunsService, TypeOrmModule],
})
export class PlantModelModule {}
