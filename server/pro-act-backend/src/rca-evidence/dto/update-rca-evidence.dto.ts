import { PartialType } from '@nestjs/swagger';
import { CreateRCAEvidenceDto } from './create-rca-evidence.dto';

export class UpdateRCAEvidenceDto extends PartialType(CreateRCAEvidenceDto) {} 