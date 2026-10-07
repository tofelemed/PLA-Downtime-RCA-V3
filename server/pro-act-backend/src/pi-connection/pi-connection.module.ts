import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIConnection } from './pi-connection.entity';
import { PIConnectionController } from './pi-connection.controller';
import { PIConnectionService } from './pi-connection.service';

@Module({
  imports: [TypeOrmModule.forFeature([PIConnection])],
  controllers: [PIConnectionController],
  providers: [PIConnectionService],
  exports: [PIConnectionService],
})
export class PIConnectionModule {}

