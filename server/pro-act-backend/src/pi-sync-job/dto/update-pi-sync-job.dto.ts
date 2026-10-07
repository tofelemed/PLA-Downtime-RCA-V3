import { PartialType } from '@nestjs/swagger';
import { CreatePISyncJobDto } from './create-pi-sync-job.dto';

export class UpdatePISyncJobDto extends PartialType(CreatePISyncJobDto) {}

