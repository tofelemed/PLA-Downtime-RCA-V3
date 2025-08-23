import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionPlanTemplateController } from './production-plan-template.controller';
import { ProductionPlanTemplateService } from './production-plan-template.service';
import { ProductionPlanTemplate } from './production-plan-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionPlanTemplate])],
  controllers: [ProductionPlanTemplateController],
  providers: [ProductionPlanTemplateService],
  exports: [ProductionPlanTemplateService],
})
export class ProductionPlanTemplateModule {} 