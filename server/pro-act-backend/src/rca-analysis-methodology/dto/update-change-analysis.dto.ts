import { PartialType } from '@nestjs/swagger';
import { CreateChangeAnalysisDto } from './create-change-analysis.dto';

export class UpdateChangeAnalysisDto extends PartialType(CreateChangeAnalysisDto) {}


