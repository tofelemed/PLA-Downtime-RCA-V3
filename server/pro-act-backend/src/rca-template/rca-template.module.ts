import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCATemplateController } from './rca-template.controller';
import { RCATemplateService } from './rca-template.service';
import { RCATemplate } from './rca-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RCATemplate])],
  controllers: [RCATemplateController],
  providers: [RCATemplateService],
  exports: [RCATemplateService],
})
export class RCATemplateModule {} 