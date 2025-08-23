import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnmappedEventController } from './unmapped-event.controller';
import { UnmappedEventService } from './unmapped-event.service';
import { UnmappedEvent } from './unmapped-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UnmappedEvent])],
  controllers: [UnmappedEventController],
  providers: [UnmappedEventService],
  exports: [UnmappedEventService],
})
export class UnmappedEventModule {} 