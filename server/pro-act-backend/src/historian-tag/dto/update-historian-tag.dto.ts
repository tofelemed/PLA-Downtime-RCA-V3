import { PartialType } from '@nestjs/swagger';
import { CreateHistorianTagDto } from './create-historian-tag.dto';

export class UpdateHistorianTagDto extends PartialType(CreateHistorianTagDto) {}

