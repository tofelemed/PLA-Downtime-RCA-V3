import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FishboneDiagram } from './fishbone-diagram.entity';
import { FishboneDiagramController } from './fishbone-diagram.controller';
import { FishboneDiagramService } from './fishbone-diagram.service';

@Module({
  imports: [TypeOrmModule.forFeature([FishboneDiagram])],
  controllers: [FishboneDiagramController],
  providers: [FishboneDiagramService],
  exports: [FishboneDiagramService],
})
export class FishboneDiagramModule {}

