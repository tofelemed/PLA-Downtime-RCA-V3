import { PartialType } from '@nestjs/swagger';
import { CreateRcaDto } from './create-rca.dto';

export class UpdateRcaDto extends PartialType(CreateRcaDto) {}
