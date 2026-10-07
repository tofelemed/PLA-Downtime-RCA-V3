import { PartialType } from '@nestjs/swagger';
import { CreateDataSourceDto } from './create-data-source.dto';

export class UpdateDataSourceDto extends PartialType(CreateDataSourceDto) {}

