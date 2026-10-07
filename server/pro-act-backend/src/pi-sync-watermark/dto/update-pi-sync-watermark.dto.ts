import { PartialType } from '@nestjs/swagger';
import { CreatePISyncWatermarkDto } from './create-pi-sync-watermark.dto';

export class UpdatePISyncWatermarkDto extends PartialType(CreatePISyncWatermarkDto) {}

