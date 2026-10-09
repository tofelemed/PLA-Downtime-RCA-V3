import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ReconcileFormController } from './reconcile-form.controller';
import { ReconcileFormService } from './reconcile-form.service';
import { ReconcileForm } from './reconcile-form.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReconcileForm]), FeatureFlagsModule],
  controllers: [ReconcileFormController],
  providers: [ReconcileFormService],
  exports: [ReconcileFormService],
})
export class ReconcileFormModule {} 