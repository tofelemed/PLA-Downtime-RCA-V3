import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIMapping } from './pi-mapping.entity';
import { PIMappingController } from './pi-mapping.controller';
import { PIMappingService } from './pi-mapping.service';

@Module({
  imports: [TypeOrmModule.forFeature([PIMapping])],
  controllers: [PIMappingController],
  providers: [PIMappingService],
  exports: [PIMappingService],
})
export class PIMappingModule {}

