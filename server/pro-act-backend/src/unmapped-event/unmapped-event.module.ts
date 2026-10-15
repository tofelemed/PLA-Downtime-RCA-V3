import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnmappedEventService } from './unmapped-event.service';
import { UnmappedEvent } from './unmapped-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UnmappedEvent])],
  providers: [UnmappedEventService],
  exports: [UnmappedEventService],
})
export class UnmappedEventModule {}
