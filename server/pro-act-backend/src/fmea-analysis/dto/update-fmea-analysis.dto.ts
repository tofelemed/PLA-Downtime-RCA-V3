import { PartialType } from '@nestjs/swagger';
import { CreateFMEAAnalysisDto } from './create-fmea-analysis.dto';

export class UpdateFMEAAnalysisDto extends PartialType(CreateFMEAAnalysisDto) {}

