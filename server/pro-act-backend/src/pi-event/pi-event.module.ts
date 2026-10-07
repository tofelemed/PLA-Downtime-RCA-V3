import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIEvent } from './pi-event.entity';
import { PIEventController } from './pi-event.controller';
import { PIEventService } from './pi-event.service';

@Module({
  imports: [TypeOrmModule.forFeature([PIEvent])],
  controllers: [PIEventController],
  providers: [PIEventService],
  exports: [PIEventService],
})
export class PIEventModule {}

