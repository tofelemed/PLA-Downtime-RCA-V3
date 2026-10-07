import { PartialType } from '@nestjs/swagger';
import { CreateQueryHistoryDto } from './create-query-history.dto';

export class UpdateQueryHistoryDto extends PartialType(CreateQueryHistoryDto) {}

