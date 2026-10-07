import { PartialType } from '@nestjs/swagger';
import { CreateFaultTreeAnalysisDto } from './create-fault-tree-analysis.dto';

export class UpdateFaultTreeAnalysisDto extends PartialType(CreateFaultTreeAnalysisDto) {}

