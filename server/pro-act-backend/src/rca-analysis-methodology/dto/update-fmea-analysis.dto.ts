import { PartialType } from '@nestjs/swagger';
import { CreateFmeaAnalysisDto } from './create-fmea-analysis.dto';

export class UpdateFmeaAnalysisDto extends PartialType(CreateFmeaAnalysisDto) {}


