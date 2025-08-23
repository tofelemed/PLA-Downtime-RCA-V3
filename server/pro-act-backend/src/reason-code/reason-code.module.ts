import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReasonCodeController } from './reason-code.controller';
import { ReasonCodeService } from './reason-code.service';
import { ReasonCode } from './reason-code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReasonCode])],
  controllers: [ReasonCodeController],
  providers: [ReasonCodeService],
  exports: [ReasonCodeService],
})
export class ReasonCodeModule {} 