import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAService } from './rca.service';
import { RCA } from './rca.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RCA])],
  providers: [RCAService],
  exports: [RCAService],
})
export class RCAModule {}
