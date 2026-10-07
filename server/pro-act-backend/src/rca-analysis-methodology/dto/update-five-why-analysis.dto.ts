import { PartialType } from '@nestjs/swagger';
import { CreateFiveWhyAnalysisDto } from './create-five-why-analysis.dto';

export class UpdateFiveWhyAnalysisDto extends PartialType(CreateFiveWhyAnalysisDto) {}


