import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCATriggerConfig } from './rca-trigger-config.entity';
import { RCATriggerConfigService } from './rca-trigger-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([RCATriggerConfig])],
  providers: [RCATriggerConfigService],
  exports: [RCATriggerConfigService],
})
export class RCATriggerConfigModule {}
