import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeModule } from '../intake/intake.module';
import { Unit } from '../unit/unit.entity';
import { MeasurementSample } from './entities/measurement-sample.entity';
import { SignalBackfillRun } from './entities/signal-backfill-run.entity';
import { SignalSummary } from './entities/signal-summary.entity';
import { Signal } from './entities/signal.entity';
import { MeasurementHandler } from './measurement.handler';
import { SampleStore } from './sample-store';
import { SignalBackfillService } from './signal-backfill.service';
import { SignalPreviewService } from './signal-preview.service';
import { SignalsService } from './signals.service';
import { Product } from '../product/product.entity';

/**
 * Signals and measurement samples of plan 1.7 (PI07–PI09, §14.2): signal definitions, the measurement
 * normaliser (registered with intake on init), versioned sample storage, quantity previews and backfill
 * runs. The PI adapter reads its signal jobs through `SignalsService` and `SignalBackfillService`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Signal,
      MeasurementSample,
      SignalSummary,
      SignalBackfillRun,
      Unit,
      Product,
    ]),
    IntakeModule,
  ],
  providers: [
    SampleStore,
    MeasurementHandler,
    SignalsService,
    SignalPreviewService,
    SignalBackfillService,
  ],
  exports: [
    SignalsService,
    SignalPreviewService,
    SignalBackfillService,
    SampleStore,
  ],
})
export class SignalsModule {}
