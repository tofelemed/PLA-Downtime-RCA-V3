import { PartialType } from '@nestjs/swagger';
import { CreateRCAKnowledgeBaseDto } from './create-rca-knowledge-base.dto';

export class UpdateRCAKnowledgeBaseDto extends PartialType(CreateRCAKnowledgeBaseDto) {}

