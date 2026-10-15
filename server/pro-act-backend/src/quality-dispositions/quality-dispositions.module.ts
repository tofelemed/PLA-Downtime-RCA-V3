import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/profiles.module';
import { LotDisposition } from './entities/lot-disposition.entity';
import { LotDispositionsService } from './lot-dispositions.service';

/** SME E3: approved lot dispositions and recovery movements the period actuals classify output with. */
@Module({
  imports: [TypeOrmModule.forFeature([LotDisposition]), ProfilesModule],
  providers: [LotDispositionsService],
  exports: [LotDispositionsService, TypeOrmModule],
})
export class QualityDispositionsModule {}
