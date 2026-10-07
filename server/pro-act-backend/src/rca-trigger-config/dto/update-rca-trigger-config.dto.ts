import { PartialType } from '@nestjs/swagger';
import { CreateRCATriggerConfigDto } from './create-rca-trigger-config.dto';

export class UpdateRCATriggerConfigDto extends PartialType(CreateRCATriggerConfigDto) {}

