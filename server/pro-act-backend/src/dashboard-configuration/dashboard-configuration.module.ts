import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardConfigurationController } from './dashboard-configuration.controller';
import { DashboardConfigurationService } from './dashboard-configuration.service';
import { DashboardConfiguration } from './dashboard-configuration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DashboardConfiguration])],
  controllers: [DashboardConfigurationController],
  providers: [DashboardConfigurationService],
  exports: [DashboardConfigurationService],
})
export class DashboardConfigurationModule {} 