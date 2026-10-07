import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { StreamDataSource } from './entities/stream-data-source.entity';
import { StreamDataSink } from './entities/stream-data-sink.entity';
import { StreamProcessorEntity } from './entities/stream-processor.entity';
import { StreamMetricEntity } from './entities/stream-metric.entity';
import { StreamAlertEntity } from './entities/stream-alert.entity';
import { StreamConnectionConfigEntity } from './entities/stream-connection-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StreamDataSource,
      StreamDataSink,
      StreamProcessorEntity,
      StreamMetricEntity,
      StreamAlertEntity,
      StreamConnectionConfigEntity,
    ]),
  ],
  controllers: [StreamingController],
  providers: [StreamingService],
  exports: [StreamingService],
})
export class StreamingModule {}


