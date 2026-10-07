import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCATriggerConfig } from './rca-trigger-config.entity';
import { RCATriggerConfigController } from './rca-trigger-config.controller';
import { RCATriggerConfigService } from './rca-trigger-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([RCATriggerConfig])],
  controllers: [RCATriggerConfigController],
  providers: [RCATriggerConfigService],
  exports: [RCATriggerConfigService],
})
export class RCATriggerConfigModule {}

