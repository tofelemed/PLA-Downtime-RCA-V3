import { PartialType } from '@nestjs/swagger';
import { CreateRCAAnalysisConfigDto } from './create-rca-analysis-config.dto';

export class UpdateRCAAnalysisConfigDto extends PartialType(CreateRCAAnalysisConfigDto) {}

