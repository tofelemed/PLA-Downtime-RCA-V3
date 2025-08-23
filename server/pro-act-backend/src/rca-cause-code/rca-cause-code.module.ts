import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCACauseCode } from './rca-cause-code.entity';
import { RCACauseCodeService } from './rca-cause-code.service';
import { RCACauseCodeController } from './rca-cause-code.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RCACauseCode])],
  providers: [RCACauseCodeService],
  controllers: [RCACauseCodeController],
  exports: [RCACauseCodeService],
})
export class RCACauseCodeModule {} 