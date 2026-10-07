import { PartialType } from '@nestjs/swagger';
import { CreateFishboneDiagramDto } from './create-fishbone-diagram.dto';

export class UpdateFishboneDiagramDto extends PartialType(CreateFishboneDiagramDto) {}

