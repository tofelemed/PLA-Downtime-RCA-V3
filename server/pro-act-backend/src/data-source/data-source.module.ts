import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from './data-source.entity';
import { DataSourceController } from './data-source.controller';
import { DataSourceService } from './data-source.service';

@Module({
  imports: [TypeOrmModule.forFeature([DataSource])],
  controllers: [DataSourceController],
  providers: [DataSourceService],
  exports: [DataSourceService],
})
export class DataSourceModule {}

