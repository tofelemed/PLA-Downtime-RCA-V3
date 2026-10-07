import { PartialType } from '@nestjs/swagger';
import { CreateBarrierAnalysisDto } from './create-barrier-analysis.dto';

export class UpdateBarrierAnalysisDto extends PartialType(CreateBarrierAnalysisDto) {}


