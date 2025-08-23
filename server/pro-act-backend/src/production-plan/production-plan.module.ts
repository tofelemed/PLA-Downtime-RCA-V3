import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionPlanController } from './production-plan.controller';
import { ProductionPlanService } from './production-plan.service';
import { ProductionPlan } from './production-plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionPlan])],
  controllers: [ProductionPlanController],
  providers: [ProductionPlanService],
  exports: [ProductionPlanService],
})
export class ProductionPlanModule {} 