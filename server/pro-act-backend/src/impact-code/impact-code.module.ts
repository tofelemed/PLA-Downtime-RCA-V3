import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImpactCode } from './impact-code.entity';
import { ImpactCodeService } from './impact-code.service';
import { ImpactCodeController } from './impact-code.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImpactCode])],
  providers: [ImpactCodeService],
  controllers: [ImpactCodeController],
  exports: [ImpactCodeService],
})
export class ImpactCodeModule {} 