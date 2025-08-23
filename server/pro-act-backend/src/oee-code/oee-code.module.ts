import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OEECode } from './oee-code.entity';
import { OEECodeService } from './oee-code.service';
import { OEECodeController } from './oee-code.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OEECode])],
  providers: [OEECodeService],
  controllers: [OEECodeController],
  exports: [OEECodeService],
})
export class OEECodeModule {} 