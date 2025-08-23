import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionLossController } from './production-loss.controller';
import { ProductionLossService } from './production-loss.service';
import { ProductionLoss } from './production-loss.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionLoss])],
  controllers: [ProductionLossController],
  providers: [ProductionLossService],
  exports: [ProductionLossService],
})
export class ProductionLossModule {} 