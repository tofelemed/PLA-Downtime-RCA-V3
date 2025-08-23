import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAController } from './rca.controller';
import { RCAService } from './rca.service';
import { RCA } from './rca.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RCA])],
  controllers: [RCAController],
  providers: [RCAService],
  exports: [RCAService],
})
export class RCAModule {} 