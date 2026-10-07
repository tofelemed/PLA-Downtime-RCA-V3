import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIAfElement } from './pi-af-element.entity';
import { PIAfElementController } from './pi-af-element.controller';
import { PIAfElementService } from './pi-af-element.service';

@Module({
  imports: [TypeOrmModule.forFeature([PIAfElement])],
  controllers: [PIAfElementController],
  providers: [PIAfElementService],
  exports: [PIAfElementService],
})
export class PIAfElementModule {}

