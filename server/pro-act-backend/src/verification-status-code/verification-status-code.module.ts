import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationStatusCode } from './verification-status-code.entity';
import { VerificationStatusCodeService } from './verification-status-code.service';
import { VerificationStatusCodeController } from './verification-status-code.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationStatusCode])],
  providers: [VerificationStatusCodeService],
  controllers: [VerificationStatusCodeController],
  exports: [VerificationStatusCodeService],
})
export class VerificationStatusCodeModule {} 