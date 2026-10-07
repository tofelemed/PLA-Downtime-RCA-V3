import { PartialType } from '@nestjs/swagger';
import { CreatePIConnectionDto } from './create-pi-connection.dto';

export class UpdatePIConnectionDto extends PartialType(CreatePIConnectionDto) {}

