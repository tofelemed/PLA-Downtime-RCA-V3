import { PartialType } from '@nestjs/swagger';
import { CreateLossCategoryDto } from './create-loss-category.dto';

/** Same fields as the create DTO (`categoryName`, not `name`), all optional (B4). */
export class UpdateLossCategoryDto extends PartialType(CreateLossCategoryDto) {}
